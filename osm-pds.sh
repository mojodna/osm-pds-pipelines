#!/usr/bin/env bash

command=$1
shift

set -euo pipefail

if [ -z $command ]; then
  >&2 echo "usage: $(basename $0) <command> [args]"
  exit 1
fi

function mirror() {
  set +u
  input=$1
  output=$2
  set -u

  if [[ -z $input || -z $output ]]; then
    >&2 echo "usage: $(basename $0) mirror <input> <output>"
    exit 1
  fi

  >&2 echo "Mirroring ${input} to ${output}..."

  if [[ "$input" =~ s3:// ]]; then
    aws s3 cp $input $output
  else
    htcat $input | pv | aws s3 cp - $output
  fi
}

function transcode() {
  set +u
  input=$1
  output=$(sed 's|^s3://|s3a://|' <<< $2)
  set -u

  if [[ -z $input || -z $output ]]; then
    >&2 echo "usage: $(basename $0) transcode <input> <output>"
    exit 1
  fi

  >&2 echo "Transcoding ${input} to ${output}..."

  aws s3 cp $input - | pv | osm2orc - $output
}

case $command in
  mirror)
    mirror $@
    ;;

  transcode)
    transcode $@
    ;;
esac
