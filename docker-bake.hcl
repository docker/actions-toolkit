// Copyright 2023 actions-toolkit authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

group "default" {
  targets = ["build"]
}

group "pre-checkin" {
  targets = ["vendor", "format", "build"]
}

group "validate" {
  targets = ["lint", "vendor-validate", "dockerfile-validate", "license-validate"]
}

target "build" {
  dockerfile = "dev.Dockerfile"
  target = "build-update"
  output = ["."]
}

target "format" {
  dockerfile = "dev.Dockerfile"
  target = "format-update"
  output = ["."]
}

target "lint" {
  dockerfile = "dev.Dockerfile"
  target = "lint"
  output = ["type=cacheonly"]
}

target "vendor" {
  dockerfile = "dev.Dockerfile"
  target = "vendor-update"
  output = ["."]
}

target "vendor-validate" {
  dockerfile = "dev.Dockerfile"
  target = "vendor-validate"
  output = ["type=cacheonly"]
}

target "dockerfile-validate" {
  matrix = {
    dockerfile = [
      "dev.Dockerfile",
      "./hack/dockerfiles/license.Dockerfile"
    ]
  }
  name = "dockerfile-validate-${md5(dockerfile)}"
  dockerfile = dockerfile
  call = "check"
}

target "test" {
  dockerfile = "dev.Dockerfile"
  target = "test"
  output = ["type=cacheonly"]
  secret = ["id=GITHUB_TOKEN,env=GITHUB_TOKEN"]
}

target "test-coverage" {
  dockerfile = "dev.Dockerfile"
  target = "test-coverage"
  output = ["./coverage"]
  secret = ["id=GITHUB_TOKEN,env=GITHUB_TOKEN"]
}

# GITHUB_REF is the actual ref that triggers the workflow and used as version
# when a tag is pushed: https://docs.github.com/en/actions/learn-github-actions/environment-variables#default-environment-variables
variable "GITHUB_REF" {
  default = ""
}

target "publish" {
  dockerfile = "dev.Dockerfile"
  args = {
    GITHUB_REF = GITHUB_REF
  }
  target = "publish"
  output = ["type=cacheonly"]
  secret = ["id=NODE_AUTH_TOKEN,env=NODE_AUTH_TOKEN"]
}

target "license-validate" {
  dockerfile = "./hack/dockerfiles/license.Dockerfile"
  target = "validate"
  output = ["type=cacheonly"]
}

target "license-update" {
  dockerfile = "./hack/dockerfiles/license.Dockerfile"
  target = "update"
  output = ["."]
}
