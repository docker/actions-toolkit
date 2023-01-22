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
	yarn run copy
	cd src && yarn publish --no-git-tag-version --access public --new-version $(PUBLISH_VERSION)
