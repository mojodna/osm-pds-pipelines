#!/usr/bin/env bash

command=$1
shift

set -eo pipefail

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

  if [[ "$input" =~ ^s3:// ]]; then
    aws s3 cp $input $output

    # Attempt to also copy the related md5 file
    aws s3 cp $input.md5 $output.md5 || echo "Unable to copy md5"

  else
    # htcat $input | pv | aws s3 cp - $output
    curl -sfL $input | pv | aws s3 cp - $output
  fi
}

function transcode() {
  opts=()

  if [[ "$1" =~ "--" ]]; then
    opts+=($1)
    shift
  fi

  input=$1
  output=$2

  if [[ -z $input || -z $output ]]; then
    >&2 echo "usage: $(basename $0) transcode <input> <output>"
    exit 1
  fi

  if [[ ! ( "$input" =~ ^s3:// && "$output" =~ ^s3:// ) ]]; then
    >&2 echo "usage: $(basename $0) transcode <input> <output>"
    >&2 echo "Only S3 URIs are supported for transcoding."
    exit 1
  fi

  >&2 echo "Transcoding ${input} to ${output}..."

  http_input=$(sed 's|s3://\([^/]*\)/|http://\1.s3.amazonaws.com/|' <<< $input)
  output=$(sed 's|^s3://|s3a://|' <<< $output)
  decompressor="cat"
  if [[ "$input" =~ \.bz2$ ]]; then
    decompressor="bzip2 -dc"
  elif [[ "$input" =~ \.gz$ ]]; then
    decompressor="gzip -dc"
  elif [[ "$input" =~ \.xz$ ]]; then
    decompressor="xz -dc"
  fi

  set +e
  size=$(aws s3 ls $input 2> /dev/null | head -1 | awk '{print $3}')
  set -e
  curl -sf $http_input | pv -s $size | $decompressor | osm2orc "${opts[@]}" - $output
}

case $command in
  mirror)
    mirror $@
    ;;

  transcode)
    transcode $@
    ;;
esac
