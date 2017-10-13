require("babel-polyfill");

const {
  BinarySplitter,
  sinks: { Kinesis },
  sources: { Changesets }
} = require("osm-replication-streams");
const osm2obj = require('osm2obj');
const stringify = require("stringify-stream");

let checkpointStream = require('./lib/checkpoint-stream');

exports.handle = (event, context, callback) => {
  checkpointStream(Changesets, (err, stream) => {
    if (err) {
      console.warn(err.stack);
      return callback(err);
    }

    stream
      .pipe(osm2obj())
      .pipe(stringify())
      .pipe(new Kinesis("changesets-json"));
  });
}

if (require.main === module) {
  exports.handle({}, {}, (err, body) => {
    if (err) {
      throw err;
    }
  });
}
