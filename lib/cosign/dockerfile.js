"use strict";
/**
 * Copyright 2025 actions-toolkit authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dockerfileContent = void 0;
exports.dockerfileContent = `
# syntax=docker/dockerfile:1

ARG GO_VERSION="1.24"
ARG ALPINE_VERSION="3.22"

FROM --platform=$BUILDPLATFORM tonistiigi/xx:1.7.0 AS xx

FROM --platform=$BUILDPLATFORM golang:\${GO_VERSION}-alpine\${ALPINE_VERSION} AS builder-base
COPY --from=xx / /
RUN apk add --no-cache git
ENV GOTOOLCHAIN=auto
ENV CGO_ENABLED=0
WORKDIR /src
RUN --mount=type=cache,target=/go/pkg/mod \\
    --mount=type=bind,source=go.mod,target=go.mod \\
    --mount=type=bind,source=go.sum,target=go.sum \\
    go mod download

FROM builder-base AS version
RUN --mount=type=bind,target=. <<'EOT'
  git rev-parse HEAD 2>/dev/null || {
    echo >&2 "Failed to get git revision, make sure --build-arg BUILDKIT_CONTEXT_KEEP_GIT_DIR=1 is set when building from Git directly"
    exit 1
  }
  set -ex
  export PKG=sigs.k8s.io BUILDDATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") TREESTATE=$(if ! git diff --no-ext-diff --quiet --exit-code; then echo dirty; else echo clean; fi) VERSION=$(git describe --match 'v[0-9]*' --dirty='.m' --always --tags) COMMIT=$(git rev-parse HEAD)$(if ! git diff --no-ext-diff --quiet --exit-code; then echo .m; fi);
  echo "-X \${PKG}/release-utils/version.gitVersion=\${VERSION} -X \${PKG}/release-utils/version.gitCommit=\${COMMIT} -X \${PKG}/release-utils/version.gitTreeState=\${TREESTATE} -X \${PKG}/release-utils/version.buildDate=\${BUILDDATE}" > /tmp/.ldflags;
  echo -n "\${VERSION}" > /tmp/.version;
EOT

FROM builder-base AS builder
ARG TARGETPLATFORM
RUN --mount=type=bind,target=. \\
    --mount=type=cache,target=/root/.cache,id=cosign-$TARGETPLATFORM \\
    --mount=source=/tmp/.ldflags,target=/tmp/.ldflags,from=version \\
    --mount=type=cache,target=/go/pkg/mod <<EOT
  set -ex
  xx-go build -trimpath -ldflags "-s -w $(cat /tmp/.ldflags)" -o /out/cosign ./cmd/cosign
  xx-verify --static /out/cosign
EOT

FROM scratch
COPY --from=builder /out /
`;
//# sourceMappingURL=dockerfile.js.map