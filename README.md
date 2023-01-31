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
const { Toolkit } = require('@docker/actions-toolkit')
const toolkit = new Toolkit()
```

## Contributing

Want to contribute to the Actions Toolkit? Awesome! You can find information
about contributing to this project in the [CONTRIBUTING.md](/.github/CONTRIBUTING.md)
