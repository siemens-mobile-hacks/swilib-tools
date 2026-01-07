#!/bin/bash
set -e
set -x
cd "$(dirname "$0")"

PREV_MD5=$(md5sum "$0" | awk '{ print $1 }')
git pull
NEXT_MD5=$(md5sum "$0" | awk '{ print $1 }')

if [[ "$PREV_MD5" != "$NEXT_MD5" ]]; then
  echo "deploy.sh is changed, restarting..."
  exec "$0" "$@"
fi

pnpm install --frozen-lockfile
pnpm build
pm2 delete swilib-tools || true
pm2 start ./ecosystem.config.cjs
