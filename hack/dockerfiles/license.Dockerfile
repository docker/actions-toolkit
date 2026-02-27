# syntax=docker/dockerfile:1

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

ARG ADDLICENSE_VERSION="v1.2.0"
ARG ALPINE_VERSION="3.23"
ARG GO_VERSION="1.26"
ARG XX_VERSION="1.9.0"

ARG LICENSE_HOLDER="actions-toolkit authors"
ARG LICENSE_TYPE="apache"
ARG LICENSE_FILES=".*\(Dockerfile\|Makefile\|\.js\|\.cjs\|\.mjs\|\.ts\|\.hcl\|\.sh|\.ps1\)"

FROM --platform=$BUILDPLATFORM tonistiigi/xx:${XX_VERSION} AS xx

FROM --platform=$BUILDPLATFORM golang:${GO_VERSION}-alpine${ALPINE_VERSION} AS base
RUN apk add --no-cache cpio findutils git
ENV CGO_ENABLED=0
WORKDIR /src
COPY --link --from=xx / /

FROM base AS addlicense
ARG ADDLICENSE_VERSION
ARG TARGETPLATFORM
RUN --mount=target=/root/.cache,type=cache \
    --mount=type=cache,target=/go/pkg/mod <<EOT
  set -ex
  xx-go install "github.com/google/addlicense@${ADDLICENSE_VERSION}"
  mkdir /out
  if ! xx-info is-cross; then
    mv /go/bin/addlicense /out
  else
    mv /go/bin/*/addlicense* /out
  fi
EOT

FROM base AS set
ARG LICENSE_HOLDER
ARG LICENSE_TYPE
ARG LICENSE_FILES
RUN --mount=type=bind,target=.,rw \
    --mount=from=addlicense,source=/out/addlicense,target=/usr/bin/addlicense \
    find . -regex "${LICENSE_FILES}" -not -path "./.yarn/*" -not -path "./lib/*" -not -path "./node_modules/*" | xargs addlicense -c "$LICENSE_HOLDER" -l "$LICENSE_TYPE" && \
    mkdir /out && \
    find . -regex "${LICENSE_FILES}" -not -path "./.yarn/*" -not -path "./lib/*"  -not -path "./node_modules/*" | cpio -pdm /out

FROM scratch AS update
COPY --from=set /out /

FROM base AS validate
ARG LICENSE_HOLDER
ARG LICENSE_TYPE
ARG LICENSE_FILES
RUN --mount=type=bind,target=. \
    --mount=from=addlicense,source=/out/addlicense,target=/usr/bin/addlicense \
    find . -regex "${LICENSE_FILES}" -not -path "./.yarn/*" -not -path "./lib/*" -not -path "./node_modules/*" | xargs addlicense -check -c "$LICENSE_HOLDER" -l "$LICENSE_TYPE"
