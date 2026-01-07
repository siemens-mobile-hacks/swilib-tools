#!/bin/bash
set -e
set -x
cd "$(dirname "$0")"

git pull
pnpm install --frozen-lockfile
pnpm build
pm2 delete swilib-tools
pm2 start ./ecosystem.config.cjs
