require("babel-polyfill");

const async = require("async");
const AWS = require("aws-sdk");
const env = require("require-env");

const S3_BUCKET = env.require("S3_BUCKET");
const S3_CHECKPOINT_KEY = env.require("S3_CHECKPOINT_KEY");

const S3 = new AWS.S3();

const {
  BinarySplitter,
  sinks: { Kinesis },
  sources: { Changes }
} = require("osm-replication-streams");

const checkpointer = async.cargo((sequenceNumbers, callback) =>
  S3.putObject(
    {
      Body: sequenceNumbers.slice(-1).toString(),
      Bucket: S3_BUCKET,
      Key: S3_CHECKPOINT_KEY
    },
    callback
  )
);

const loadStartingSequence = callback =>
  S3.getObject(
    {
      Bucket: S3_BUCKET,
      Key: S3_CHECKPOINT_KEY
    },
    (err, data) => {
      if (err) {
        return callback(err);
      }

      return callback(null, parseInt(data.Body.toString(), 10));
    }
  );

const checkpoint = sequenceNumber => checkpointer.push(sequenceNumber);

const cleanup = callback => err => {
  if (checkpointer.idle()) {
    return callback(err);
  }

  checkpointer.drain = callback.apply(null, err);
};

exports.handle = (event, context, callback) =>
  loadStartingSequence((err, initialSequence) => {
    if (err) {
      console.warn(err.stack);
      return callback(err);
    }

    const stream = Changes({
      infinite: false,
      initialSequence: initialSequence + 1,
      checkpoint
    })
      .pipe(new BinarySplitter("\u001e"))
      .pipe(new Kinesis("changes-xml"));

    // TODO on error, rewind since the record wouldn't have been written to
    // Kinesis
    stream.on("error", err => cleanup(callback));
    stream.on("finish", () => cleanup(callback));
  });

if (require.main === module) {
  exports.handle({}, {}, (err, body) => {
    if (err) {
      throw err;
    }
  });
}
