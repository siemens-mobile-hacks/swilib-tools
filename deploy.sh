#!/bin/bash
set -e
set -x
git pull
npm install
pm2 reload swilib-tools
