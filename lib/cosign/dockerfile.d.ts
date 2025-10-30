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
export declare const dockerfileContent = "\n# syntax=docker/dockerfile:1\n\nARG GO_VERSION=\"1.24\"\nARG ALPINE_VERSION=\"3.22\"\n\nFROM --platform=$BUILDPLATFORM tonistiigi/xx:1.7.0 AS xx\n\nFROM --platform=$BUILDPLATFORM golang:${GO_VERSION}-alpine${ALPINE_VERSION} AS builder-base\nCOPY --from=xx / /\nRUN apk add --no-cache git\nENV GOTOOLCHAIN=auto\nENV CGO_ENABLED=0\nWORKDIR /src\nRUN --mount=type=cache,target=/go/pkg/mod \\\n    --mount=type=bind,source=go.mod,target=go.mod \\\n    --mount=type=bind,source=go.sum,target=go.sum \\\n    go mod download\n\nFROM builder-base AS version\nRUN --mount=type=bind,target=. <<'EOT'\n  git rev-parse HEAD 2>/dev/null || {\n    echo >&2 \"Failed to get git revision, make sure --build-arg BUILDKIT_CONTEXT_KEEP_GIT_DIR=1 is set when building from Git directly\"\n    exit 1\n  }\n  set -ex\n  export PKG=sigs.k8s.io BUILDDATE=$(date -u +\"%Y-%m-%dT%H:%M:%SZ\") TREESTATE=$(if ! git diff --no-ext-diff --quiet --exit-code; then echo dirty; else echo clean; fi) VERSION=$(git describe --match 'v[0-9]*' --dirty='.m' --always --tags) COMMIT=$(git rev-parse HEAD)$(if ! git diff --no-ext-diff --quiet --exit-code; then echo .m; fi);\n  echo \"-X ${PKG}/release-utils/version.gitVersion=${VERSION} -X ${PKG}/release-utils/version.gitCommit=${COMMIT} -X ${PKG}/release-utils/version.gitTreeState=${TREESTATE} -X ${PKG}/release-utils/version.buildDate=${BUILDDATE}\" > /tmp/.ldflags;\n  echo -n \"${VERSION}\" > /tmp/.version;\nEOT\n\nFROM builder-base AS builder\nARG TARGETPLATFORM\nRUN --mount=type=bind,target=. \\\n    --mount=type=cache,target=/root/.cache,id=cosign-$TARGETPLATFORM \\\n    --mount=source=/tmp/.ldflags,target=/tmp/.ldflags,from=version \\\n    --mount=type=cache,target=/go/pkg/mod <<EOT\n  set -ex\n  xx-go build -trimpath -ldflags \"-s -w $(cat /tmp/.ldflags)\" -o /out/cosign ./cmd/cosign\n  xx-verify --static /out/cosign\nEOT\n\nFROM scratch\nCOPY --from=builder /out /\n";
