require("babel-polyfill");
const async = require("async");
const AWS = require("aws-sdk");
const env = require("require-env");

const S3_BUCKET = env.require("S3_BUCKET");
const S3_CHECKPOINT_KEY = env.require("S3_CHECKPOINT_KEY");

const S3 = new AWS.S3();

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
        if (err.code === 'NoSuchKey') {
          // This is the first time the source stream is run
          // Force a null initial state to get the latest
          // replication number
          return callback(null, null);
        }
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

/**
 * function that wraps a source streamfrom osm-replication-streams
 * and adds checkpointing on S3 
 * 
 * @param {*} source - source stream
 * @param {*} callback - (err, stream) callback - returns err or the stream
 */
function checkpointStream (source, callback) {
  loadStartingSequence((err, initialSequence) => {
    if (err) {
      return callback(err);
    }
    const stream = source({
      infinite: false,
      initialSequence: initialSequence? initialSequence + 1: null,
      checkpoint
    })

    stream.on("error", cleanup(callback));
    stream.on("finish", cleanup(callback));

    return callback(null, stream);
  });
}

module.exports = checkpointStream;