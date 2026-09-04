#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "No encontre Node.js 20 o superior."
  exit 1
fi
PORT=$(node -e 'const net=require("net");let p=3000;function probe(){const s=net.createServer();s.once("error",()=>{p++;probe()});s.once("listening",()=>s.close(()=>process.stdout.write(String(p))));s.listen(p,"127.0.0.1")}probe()')
echo "Iniciando ManaShelf v2.5.26-beta en http://127.0.0.1:${PORT}"
PORT="$PORT" node server.mjs &
PID=$!
sleep 1
xdg-open "http://127.0.0.1:${PORT}/?build=2.5.26-beta" >/dev/null 2>&1 || true
wait "$PID"
