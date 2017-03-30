# OSM Public Dataset Pipelines

This project contains configuration and glue code to facilitate mirroring and
transcoding OpenStreetMap data into the AWS OSM Public Dataset.

## Lambda Function

`functions/mirror` contains a Lambda function intended for deployment using
[Apex](http://apex.run/). It is intended to be triggered by a CloudWatch Event
periodically in order to compare the contents of the OSM PDS S3 bucket with what
`rsync` reports is available on `planet.openstreetmap.org`. MD5 hashes are
mirrored immediately (and used as indicators as to whether Batch jobs have been
submitted); larger files are queued for mirroring using AWS Batch.

## Processing

`osm-pds.sh` is the main entrypoint and responsible for most of the heavy
lifting. It includes support for mirroring files from `planet.openstreetmap.org`
and transcoding them into [ORC](https://orc.apache.org/).

Transcoding uses [OSM2ORC](https://github.com/mojodna/osm2orc) under the hood.

## Docker Image

`Dockerfile` produces a [Docker
image](https://quay.io/repository/mojodna/osm-pds-pipelines):
`quay.io/mojodna/osm-pds-pipelines` intended for use by AWS Batch jobs.

Quay automatically builds updated images when changes are pushed to GitHub.

## Configuration

`aws/` contains configurations for an AWS Batch environment intended for use
with the AWS command line interface.

## Deploying

To deploy the Lambda function:

```bash
make deploy
```

(Appropriate roles (created by `apex init`) need to exist for this to succeed.)

To build the Docker image locally (for testing):

```bash
make
```

To create an AWS Batch environment:

```bash
make compute-environment job-queue register-job-definitions
```

To manually submit jobs:

```bash
make submit-job job=aws/sample-mirror-changeset-job.json.hbs
```
