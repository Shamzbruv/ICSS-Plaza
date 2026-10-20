#!/bin/sh
set -eu
if [ "$(id -u)" = 0 ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
  exec su-exec node "$@"
fi
exec "$@"
