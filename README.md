[![Version](https://img.shields.io/npm/v/@docker/actions-toolkit?label=version&logo=npm&style=flat-square)](https://www.npmjs.com/package/@docker/actions-toolkit)
[![Downloads](https://img.shields.io/npm/dw/@docker/actions-toolkit?logo=npm&style=flat-square)](https://www.npmjs.com/package/@docker/actions-toolkit)
[![Build workflow](https://img.shields.io/github/actions/workflow/status/docker/actions-toolkit/build.yml?label=build&logo=github&style=flat-square)](https://github.com/docker/actions-toolkit/actions?workflow=build)
[![Test workflow](https://img.shields.io/github/actions/workflow/status/docker/actions-toolkit/test.yml?label=test&logo=github&style=flat-square)](https://github.com/docker/actions-toolkit/actions?workflow=test)
[![Validate workflow](https://img.shields.io/github/actions/workflow/status/docker/actions-toolkit/validate.yml?label=validate&logo=github&style=flat-square)](https://github.com/docker/actions-toolkit/actions?workflow=validate)
[![Codecov](https://img.shields.io/codecov/c/github/docker/actions-toolkit?logo=codecov&style=flat-square)](https://codecov.io/gh/docker/actions-toolkit)

# Actions Toolkit

Toolkit for Docker (GitHub) Actions.

## :test_tube: Experimental

This repository is considered **EXPERIMENTAL** and under active development
until further notice. It is subject to non-backward compatible changes or
removal in any future version.

## About

This repository contains the source code for the toolkit that is consumed as
a library by most of our GitHub Actions:

* [docker/bake-action](https://github.com/docker/bake-action)
* [docker/build-push-action](https://github.com/docker/build-push-action)
* [docker/login-action](https://github.com/docker/login-action)
* [docker/metadata-action](https://github.com/docker/metadata-action)
* [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action)
* [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action)

This toolkit provides some utilities and common logic when developing GitHub
Actions and also acts as a minimal wrapper around our build tooling such as
[Buildx](https://github.com/docker/buildx) and [BuildKit](https://github.com/moby/buildkit)
and provides an easier API for interacting with them.

## Installation

```console
$ npm install @docker/actions-toolkit
```

## Usage

```js
const { Toolkit } = require('@docker/actions-toolkit/lib/toolkit')
const toolkit = new Toolkit()
```

## Contributing

Want to contribute to the Actions Toolkit? Awesome! You can find information
about contributing to this project in the [CONTRIBUTING.md](/.github/CONTRIBUTING.md)
