#!/usr/bin/env bash
cd "$(dirname "$0")"
( sleep 1; xdg-open http://127.0.0.1:3000 >/dev/null 2>&1 ) &
node server.mjs
