require("babel-polyfill");

const env = require("require-env");
const {
  BinarySplitter,
  sinks: { Kinesis },
  sources: { Changes }
} = require("osm-replication-streams");
const osm2obj = require('osm2obj');
const stringify = require("stringify-stream");
const through2 = require("through2");

const checkpointStream = require('./lib/checkpoint-stream');

const STREAM_NAME = env.require("STREAM_NAME");

/**
 * A simplified protocol of the osm2obj format omits
 * the action property of each OSM entity and attaches
 * the visible property following these rules:
 * 
 * 1. If the action is a create, then visible=true because
 * a created entity is a visible entity with version=1
 * 2. If the action is a modify, then visible=true with a 
 * version > 1
 * 3. If the action is a delete, then visible=false
 * 
 * @param {Object} obj - An osm2obj object
 * @returns {Object} A simplified object
 * 
 */
const obj2simple = obj => {
  let res = {};

  // Omit the action
  for (var prop in obj) {
    if (prop !== 'action') {
      res[prop] = obj[prop];
    }
  }

  if (obj['action']) {
    res.visible = ['create', 'modify'].includes(obj['action']);
  }
  return res;
}



exports.handle = (event, context, callback) =>
  checkpointStream(Changes, (err, stream) => {
    if (err) {
      console.warn(err.stack);
      return callback(err);
    }

    stream
      .pipe(osm2obj())
      .pipe(through2.obj((obj, enc, cb) => {
        cb(null, obj2simple(obj));
      }))
      .pipe(stringify())
      .pipe(new Kinesis(STREAM_NAME));
  });

if (require.main === module) {
  exports.handle({}, {}, (err, body) => {
    if (err) {
      throw err;
    }
  });
}
