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

  curl --retry 5 $input | aws s3 cp - $output
}

case $command in
  mirror)
    mirror $@
    ;;
esac
