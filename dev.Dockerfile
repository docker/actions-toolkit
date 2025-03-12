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

ARG NODE_VERSION=20
ARG DOCKER_VERSION=27.2.1
ARG BUILDX_VERSION=0.22.0-rc1
ARG COMPOSE_VERSION=2.32.4
ARG UNDOCK_VERSION=0.8.0

FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache cpio findutils git
WORKDIR /src
RUN --mount=type=bind,target=.,rw \
  --mount=type=cache,target=/src/.yarn/cache <<EOT
  corepack enable
  yarn --version
  yarn config set --home enableTelemetry 0
EOT

FROM base AS deps
RUN --mount=type=bind,target=.,rw \
  --mount=type=cache,target=/src/.yarn/cache \
  --mount=type=cache,target=/src/node_modules \
  yarn install && mkdir /vendor && cp yarn.lock /vendor

FROM scratch AS vendor-update
COPY --from=deps /vendor /

FROM deps AS vendor-validate
RUN --mount=type=bind,target=.,rw <<EOT
  set -e
  git add -A
  cp -rf /vendor/* .
  if [ -n "$(git status --porcelain -- yarn.lock)" ]; then
    echo >&2 'ERROR: Vendor result differs. Please vendor your package with "docker buildx bake vendor-update"'
    git status --porcelain -- yarn.lock
    exit 1
  fi
EOT

FROM deps AS build
RUN --mount=type=bind,target=.,rw \
  --mount=type=cache,target=/src/.yarn/cache \
  --mount=type=cache,target=/src/node_modules \
  yarn run build && mkdir /out && cp -Rf lib /out/

FROM scratch AS build-update
COPY --from=build /out /

FROM deps AS format
RUN --mount=type=bind,target=.,rw \
  --mount=type=cache,target=/src/.yarn/cache \
  --mount=type=cache,target=/src/node_modules \
  yarn run format \
  && mkdir /out && find . -name '*.ts' -not -path './node_modules/*' -not -path './.yarn/*' | cpio -pdm /out

FROM scratch AS format-update
COPY --from=format /out /

FROM deps AS lint
RUN --mount=type=bind,target=.,rw \
  --mount=type=cache,target=/src/node_modules \
  yarn run lint

FROM docker:${DOCKER_VERSION} AS docker
FROM docker/buildx-bin:${BUILDX_VERSION} AS buildx
FROM docker/compose-bin:v${COMPOSE_VERSION} AS compose
FROM crazymax/undock:${UNDOCK_VERSION} AS undock

FROM deps AS test
RUN --mount=type=bind,target=.,rw \
    --mount=type=cache,target=/src/.yarn/cache \
    --mount=type=cache,target=/src/node_modules \
    --mount=type=bind,from=docker,source=/usr/local/bin/docker,target=/usr/bin/docker \
    --mount=type=bind,from=buildx,source=/buildx,target=/usr/libexec/docker/cli-plugins/docker-buildx \
    --mount=type=bind,from=buildx,source=/buildx,target=/usr/bin/buildx \
    --mount=type=bind,from=compose,source=/docker-compose,target=/usr/libexec/docker/cli-plugins/docker-compose \
    --mount=type=bind,from=compose,source=/docker-compose,target=/usr/bin/compose \
    --mount=type=bind,from=undock,source=/usr/local/bin/undock,target=/usr/bin/undock \
    --mount=type=secret,id=GITHUB_TOKEN \
  GITHUB_TOKEN=$(cat /run/secrets/GITHUB_TOKEN) yarn run test:coverage --coverageDirectory=/tmp/coverage

FROM scratch AS test-coverage
COPY --from=test /tmp/coverage /

FROM base AS publish
ARG GITHUB_REF
RUN --mount=type=bind,target=.,rw \
    --mount=type=cache,target=/src/.yarn/cache \
    --mount=type=cache,target=/src/node_modules \
    --mount=type=secret,id=NODE_AUTH_TOKEN <<EOT
  set -e
  if ! [[ $GITHUB_REF =~ ^refs/tags/v ]]; then
    echo "GITHUB_REF is not a tag"
    exit 1
  fi
  yarn install
  yarn run build
  npm config set //registry.npmjs.org/:_authToken $(cat /run/secrets/NODE_AUTH_TOKEN)
  npm version --no-git-tag-version ${GITHUB_REF#refs/tags/v}
  npm publish --access public

  # FIXME: Can't publish with yarn berry atm: https://github.com/changesets/changesets/pull/674
  #NODE_AUTH_TOKEN=$(cat /run/secrets/NODE_AUTH_TOKEN) yarn publish --no-git-tag-version --new-version ${GITHUB_REF#refs/tags/v}
EOT
