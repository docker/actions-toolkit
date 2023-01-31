group "default" {
  targets = ["build"]
}

group "pre-checkin" {
  targets = ["vendor", "format", "build"]
}

group "validate" {
  targets = ["lint", "vendor-validate", "license-validate"]
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
