require("babel-polyfill");

const env = require("require-env");
const {
  BinarySplitter,
  sinks: { Kinesis },
  sources: { Changesets }
} = require("osm-replication-streams");
const osm2obj = require('osm2obj');
const stringify = require("stringify-stream");

const checkpointStream = require('./lib/checkpoint-stream');

const STREAM_NAME = env.require("STREAM_NAME");

exports.handle = (event, context, callback) =>
  checkpointStream(Changesets, (err, stream) => {
    if (err) {
      console.warn(err.stack);
      return callback(err);
    }

    stream
      .pipe(osm2obj())
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
