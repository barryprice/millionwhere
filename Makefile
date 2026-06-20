.PHONY: lint markuplint eslint push setup clean

CONTAINER := millionwhere-linter
IMAGE     := ubuntu:r

setup:
	@lxc info $(CONTAINER) >/dev/null 2>&1 || lxc launch $(IMAGE) $(CONTAINER)
	@lxc exec $(CONTAINER) -- bash -c 'command -v node || (apt-get update -qq && apt-get install -y -qq nodejs npm)'
	@lxc exec $(CONTAINER) -- bash -c 'test -x /usr/local/bin/eslint || npm install -g eslint'

push:
	@lxc info $(CONTAINER) >/dev/null 2>&1 || $(MAKE) setup
	lxc exec $(CONTAINER) -- rm -f /tmp/index.html /tmp/.markuplintrc.json /tmp/eslint.config.cjs
	lxc file push index.html $(CONTAINER)/tmp/index.html
	lxc file push .markuplintrc.json $(CONTAINER)/tmp/.markuplintrc.json
	lxc file push eslint.config.cjs $(CONTAINER)/tmp/eslint.config.cjs

markuplint: push
	lxc exec $(CONTAINER) -- npx --yes markuplint /tmp/index.html

eslint: push
	lxc exec $(CONTAINER) -- bash -c 'cd /tmp && node -e "require(\"eslint-plugin-html\")" 2>/dev/null || npm install eslint-plugin-html @eslint/js --save'
	lxc exec $(CONTAINER) -- bash -c 'cd /tmp && /usr/local/bin/eslint -c eslint.config.cjs --no-ignore index.html'

lint:
	$(MAKE) markuplint
	$(MAKE) eslint

clean:
	lxc delete $(CONTAINER) --force
