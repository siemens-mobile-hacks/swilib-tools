#!/bin/bash
set -e
set -x
cd "$(dirname "$0")"

git pull
pnpm install --frozen-lockfile
pnpm build
pm2 restart ./ecosystem.config.cjs
