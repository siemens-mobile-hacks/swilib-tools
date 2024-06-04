#!/bin/bash
set -e
set -x
git fetch origin
git diff main origin/main

echo ""
read -p "Deploy this changes? [y/n] "
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
	git merge origin/main
	npm install
	pm2 reload swilib-tools
fi
