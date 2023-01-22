PUBLISH_VERSION ?=

ifndef PUBLISH_VERSION
$(error PUBLISH_VERSION is not set)
endif

.PHONY: all
all:

.PHONY: publish
publish:
	yarn install
	yarn build
	yarn publish --no-git-tag-version --new-version $(PUBLISH_VERSION)
