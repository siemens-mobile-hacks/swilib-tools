#!/bin/bash
set -e
set -x
git pull
pm2 reload swilib-tools
