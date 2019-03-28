"use strict"

const path = require('path')

const async = require('async')
const AWS = require('aws-sdk')
const env = require('require-env')
const request = require('request')
const Rsync = require('rsync')

const batch = new AWS.Batch()
const s3 = new AWS.S3()

const BATCH_JOB_QUEUE = env.require('BATCH_JOB_QUEUE')
const S3_BUCKET = env.require('S3_BUCKET')
const RSYNC_SOURCE_PREFIX = 'rsync://planet.osm.org/planet/'
const HTTP_SOURCE_PREFIX = 'https://planet.osm.org/'

const NOW = new Date();

const PATHS_TO_CHECK = [
  'planet/' + NOW.getFullYear() - 1 + '/',
  'planet/' + NOW.getFullYear() + '/',
  'pbf/',
  'pbf/full-history/'
]

const FILES_TO_MIRROR = /((planet|history)-\d{6}.osm.pbf|changesets-\d{6}.osm.bz2)/
const STARTING_DATE = new Date(Date.now() - (30 * 86400e3))

const flatten = arr => arr.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), [])

const mirror = (src, dst, jobName, dependsOn, callback) => {
  console.log(`Mirroring ${src} to ${dst}...`)
  if (dependsOn != null) {
    dependsOn = [
      {
        jobId: dependsOn
      }
    ]
  }

  return batch.submitJob({
    jobDefinition: 'mirror',
    jobName,
    jobQueue: BATCH_JOB_QUEUE,
    parameters: {
      src,
      dst
    },
    dependsOn
  }, (err, data) => {
    if (err) {
      return callback(err)
    }

    return callback(null, data.jobId)
  })
}

const transcode = (type, src, dst, jobName, dependsOn, callback) => {
  console.log(`Transcoding (${type}) ${src} to ${dst}...`)
  if (dependsOn != null) {
    dependsOn = [
      {
        jobId: dependsOn
      }
    ]
  }

  return batch.submitJob({
    jobDefinition: `transcode-${type}`,
    jobName,
    jobQueue: BATCH_JOB_QUEUE,
    parameters: {
      src,
      dst
    },
    dependsOn
  }, (err, data) => {
    if (err) {
      return callback(err)
    }

    return callback(null, data.jobId)
  })
}

exports.handle = (event, context, callback) => {
  console.log('processing event: %j', event)

  return async.parallel({
    remote: done => {
      return async.map(PATHS_TO_CHECK, (path, fin) => {
        const _stdout = []
        const _stderr = []

        const rsync = new Rsync()
          .set('list-only')
          .source(`${RSYNC_SOURCE_PREFIX}${path}`)

        const env = process.env
        env.PATH += ':/var/task/bin'

        rsync.env(env)

        return rsync.execute((err, code, cmd) => {
          const stdout = Buffer.concat(_stdout).toString()
          const stderr = Buffer.concat(_stderr).toString()

          if (err) {
            if (code === 23) {
              // no such path
              return fin(null, [])
            }

            console.warn('stdout:\n', stdout)
            console.warn('stderr:\n', stderr)

            return fin(err)
          }

          const entries = stdout.split('\n')
            .filter(line => !!line)
            .map(line => {
              const parts = line.split(/\s+/)

              return {
                mode: parts[0],
                size: Number(parts[1]),
                date: new Date(`${parts[2]} ${parts[3]}`),
                path: `${path}${parts[4]}`,
                filename: parts[4]
              }
            })

          return fin(null, entries)
        }, chunk => {
          _stdout.push(chunk)
        }, chunk => {
          _stderr.push(chunk)
        })
      }, (err, data) => {
        return done(err, flatten(data))
      })
    },
    local: done => {
      return s3.listObjects({
        Bucket: S3_BUCKET,
      }, (err, data) => {
        if (err) {
          return done(err)
        }

        const entries = data.Contents.map(entry => {
          return {
            date: entry.LastModified,
            size: entry.Size,
            filename: entry.Key
          }
        })

        return done(null, entries)
      })
    }
  }, (err, results) => {
    if (err) {
      return callback(err)
    }

    const localFiles = results.local.map(info => info.filename)
    const toMirror = results.remote
      .filter(info => info.filename.match(FILES_TO_MIRROR))
      .filter(info => info.date >= STARTING_DATE)
      .filter(info => {
        // filenames don't include the century (and the year may not be in the
        // path, depending on the source)
        const ts = info.filename.match(/\d{6}/)[0];
        const year = Math.floor(NOW.getFullYear() / 100) + ts.slice(0, 2)

        return localFiles.indexOf(`${year}/${info.filename}`) < 0
      })

    const latestByType = toMirror.map(x => x.filename)
      .concat(localFiles)
      .filter(x => !x.endsWith('.md5'))
      .reduce((latest, filename) => {
        // use replace not path.basename w/ path.extname because multiple extensions may be present
        const [type, date] = filename.split("/").pop().replace(/\..+/, '').split(/-/)

        if (!Number.isNaN(parseInt(date))) {
          latest[type] = Math.max(latest[type] || 0, parseInt(date))
        }

        return latest;
      }, {})

    return async.forEachLimit(toMirror, 10, (info, done) => {
      // filenames don't include the century (and the year may not be in the
      // path, depending on the source)
      const ts = info.filename.match(/\d{6}/)[0];
      const year = Math.floor(NOW.getFullYear() / 100) + ts.slice(0, 2)

      if (path.extname(info.filename) !== '.md5' &&
          localFiles.indexOf(`${year}/${info.filename}.md5`) < 0) {
        return request.get(`${HTTP_SOURCE_PREFIX}${info.path}.md5`, (err, rsp, body) => {
          if (err) {
            return done(err)
          }

          return async.parallel({
            putObject: async.apply(s3.putObject.bind(s3), {
              Bucket: S3_BUCKET,
              Key: `${year}/${info.filename}.md5`,
              Body: body
            }),
            submitJob: done => {
              // use replace not path.basename w/ path.extname because multiple extensions may be present
              const basename = info.filename.replace(/\..+/, '')
              const [type, date] = basename.split(/-/)
              let target = type

              if (type === 'history') {
                target = 'planet-history'
              }

              //AWS Batch Job id for the mirror job, need to save to submit dependent planet-latest.osm.pbf  mirror job
              let mirrorJobId;
              
              return async.waterfall([
                //Function 1 of the waterfall to  mirror osm files
                (callback) => {
                    mirror(
                      `${HTTP_SOURCE_PREFIX}${info.path}`,
                      `s3://${S3_BUCKET}/${year}/${info.filename}`,
                      `mirror-${basename}`,
                      null,
                      (err,jobId) => { //callback from submitting the job to AWS Batch
                        if(err) return done(err);
                        mirrorJobId = jobId;
                        callback(null,jobId);
                      }
                    )
                },
                //Function 2 of the water fall to transcode files to .orc
                async.apply(
                  transcode,
                  type,
                  `s3://${S3_BUCKET}/${year}/${info.filename}`,
                  `s3://${S3_BUCKET}/${year}/${basename}.orc`,
                  `transcode-${basename}`
                )
              ], (err, transcodeJobId) => {
                if (err) {
                  return done(err);
                }

                // compare date to the max date available to determine whether it needs to be placed
                if (latestByType[type] === Number(date)) {
                  return async.parallel([
                    //Copy the latest planet.pbf file to pbf/planet-latest.osm.pbf 
                    (callback) => {
                      if (type === 'planet' && info.filename.endsWith('.pbf')) {
                        mirror(
                          `s3://${S3_BUCKET}/${year}/${info.filename}`,
                          `s3://${S3_BUCKET}/pbf/planet-latest.osm.pbf `,
                          `place-planet-latest`,
                          mirrorJobId,
                          (err,jobId) => { //callback from submitting the job to AWS Batch
                            if(err) return done(err);
                            callback();
                          }
                        )
                      } else {
                        //The file is not the latest planet.pbf file, nothing to do
                        callback();
                      }  
                    },
                    //Copy the latest orc files
                    async.apply(
                      mirror,
                      `s3://${S3_BUCKET}/${year}/${basename}.orc`,
                      `s3://${S3_BUCKET}/${target}/${type}-latest.orc`,
                      `place-${basename}`,
                      transcodeJobId,
                    )
                  ], (err) => {
                    if (err) {
                      return done(err);
                    }
                    return done();
                  });
                }

                return done()
              })
            }
          }, done)
        })
      }

      return done()
    }, err => {
      if (err) {
        return callback(err)
      }

      return callback()
    })

    // TODO compare toMirror with results.local (using filename)

    // TODO keep status (or copy MD5s in this process to determine which jobs to queue)
  })
}

if (require.main === module) {
  exports.handle({

  }, {

  }, (err, body) => {
    if (err) {
      throw err
    }

    if (body) {
      console.log(body)
    }
  })
}
