# syntax=docker/dockerfile:1

ARG NODE_VERSION=16
ARG DOCKER_VERSION=20.10.22
ARG BUILDX_VERSION=0.10.0

FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache cpio findutils git
RUN yarn config set --home enableTelemetry 0
WORKDIR /src

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

FROM docker:${DOCKER_VERSION} as docker
FROM docker/buildx-bin:${BUILDX_VERSION} as buildx

FROM deps AS test
RUN --mount=type=bind,target=.,rw \
    --mount=type=cache,target=/src/.yarn/cache \
    --mount=type=cache,target=/src/node_modules \
    --mount=type=bind,from=docker,source=/usr/local/bin/docker,target=/usr/bin/docker \
    --mount=type=bind,from=buildx,source=/buildx,target=/usr/libexec/docker/cli-plugins/docker-buildx \
    --mount=type=bind,from=buildx,source=/buildx,target=/usr/bin/buildx \
    --mount=type=secret,id=GITHUB_TOKEN \
  GITHUB_TOKEN=$(cat /run/secrets/GITHUB_TOKEN) yarn run test-coverage --coverageDirectory=/tmp/coverage

FROM scratch AS test-coverage
COPY --from=test /tmp/coverage /
