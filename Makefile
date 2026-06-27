.PHONY: ensure-uv ensure-nodeenv ensure-node markuplint eslint lint clean

NODE_VENV := .node-venv
NODE     := $(NODE_VENV)/bin/node
NPM      := $(NODE_VENV)/bin/npm
NPX      := $(NODE_VENV)/bin/npx

export PATH := $(CURDIR)/$(NODE_VENV)/bin:$(PATH)

all: lint

ensure-uv:
	@command -v uv >/dev/null 2>&1 || { \
		echo "Installing uv snap..."; \
		sudo snap install astral-uv --classic; \
	}

ensure-nodeenv: ensure-uv
	@uv tool run nodeenv --version >/dev/null 2>&1 || uv tool install nodeenv

ensure-node: ensure-nodeenv
	@if [ ! -x $(NODE) ]; then \
		uv tool run nodeenv $(NODE_VENV); \
	fi

markuplint: ensure-node
	@$(NPX) --yes markuplint index.html

eslint: ensure-node
	@${NODE} -e 'require("@eslint/js")' 2>/dev/null || ${NPM} install @eslint/js --save
	@${NPX} --yes eslint -c eslint.config.cjs --no-ignore app.js

lint:
	@$(MAKE) markuplint
	@$(MAKE) eslint

clean:
	@rm -rf ${NODE_VENV} node_modules package.json package-lock.json
