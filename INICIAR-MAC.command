#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
 echo "No encontre Node.js 20 o superior."
 read -p "Enter para cerrar..."
 exit 1
fi
open http://127.0.0.1:3000
node server.mjs
