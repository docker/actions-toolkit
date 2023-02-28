#!/usr/bin/env bash

# Copyright 2023 actions-toolkit authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

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
