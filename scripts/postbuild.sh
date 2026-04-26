#!/usr/bin/env bash
# Kopiert public/ und .next/static/ in den Next.js-Standalone-Build,
# damit der Server unter .next/standalone/server.js statische Assets findet.
# Idempotent: kann beliebig oft nach `next build` ausgeführt werden.
set -euo pipefail

if [ ! -f .next/standalone/server.js ]; then
  echo "postbuild: .next/standalone/server.js nicht gefunden – wurde 'next build' mit output:'standalone' gelaufen?" >&2
  exit 1
fi

rm -rf .next/standalone/public .next/standalone/.next/static
if [ -d public ]; then
  cp -r public .next/standalone/
fi
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/
