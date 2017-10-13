require("babel-polyfill");

const {
  BinarySplitter,
  sinks: { Kinesis },
  sources: { Changesets }
} = require("osm-replication-streams");

let checkpointStream = require('./lib/checkpoint-stream');

exports.handle = (event, context, callback) => {
  checkpointStream(Changesets, (err, stream) => {
    if (err) {
      console.warn(err.stack);
      return callback(err);
    }
    // TODO on error, rewind since the record wouldn't have been written to
    // Kinesis
    stream
      .pipe(new BinarySplitter("\u001e"))
      .pipe(new Kinesis("changesets-xml"));
  });
}

if (require.main === module) {
  exports.handle({}, {}, (err, body) => {
    if (err) {
      throw err;
    }
  });
}