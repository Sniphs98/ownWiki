#!/bin/sh
# Runs migrations and the server as the unprivileged "node" user. Started as
# root only to take over /app/data first: volumes from older images, which
# ran everything as root, are owned by root.
set -e

if [ "$(id -u)" = "0" ]; then
	chown -R node:node /app/data
	exec setpriv --reuid=node --regid=node --init-groups "$0" "$@"
fi

node scripts/migrate.js
exec node build
