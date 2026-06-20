# Millionaire Where?

Select your currency and enter your bank balance to see which countries you'd be a millionaire in — rendered on an interactive Leaflet map using live exchange rates.

## Lint

We can check the HTML and JavaScript before committing changes via:

```bash
make lint      # run markuplint + eslint
make markuplint
make eslint
make clean     # destroy the container
```

Linting runs inside an LXD container (`millionwhere-linter`) to avoid installing hundreds of Node.js dependencies in the development environment.

A working LXD setup is a hard requirement for the linter, see [the LXD documentation website](https://canonical.com/lxd/docs/default/) for more.
