#!/usr/bin/env bash

set -eu

: "${TOOLDIR=}"
: "${RUNDIR=}"
: "${DOCKER_HOST=}"

export PATH="$TOOLDIR::$PATH"

if [ -z "$DOCKER_HOST" ]; then
  echo >&2 'error: DOCKER_HOST required'
  false
fi

if ! command -v dockerd &> /dev/null; then
  echo >&2 'error: dockerd missing from PATH'
  false
fi

mkdir -p "$RUNDIR"

(
  echo "Starting dockerd"
  set -x
  exec dockerd \
    --host="$DOCKER_HOST" \
    --exec-root="$RUNDIR/execroot" \
    --data-root="$RUNDIR/data" \
    --pidfile="$RUNDIR/docker.pid" \
    --userland-proxy=false \
    2>&1 | tee "$RUNDIR/dockerd.log"
) &

tries=60
while ! docker version &> /dev/null; do
  ((tries--))
  if [ $tries -le 0 ]; then
    if [ -z "$DOCKER_HOST" ]; then
      echo >&2 "error: daemon failed to start"
    else
      echo >&2 "error: daemon at $DOCKER_HOST fails to 'docker version':"
      docker version >&2 || true
    fi
    false
  fi
  sleep 2
done
