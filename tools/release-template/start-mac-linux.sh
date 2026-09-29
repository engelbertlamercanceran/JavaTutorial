#!/bin/sh
# HACKO launcher for macOS / Linux
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  HACKO needs Node.js to run."
  echo "  1) Install it from  https://nodejs.org"
  echo "  2) Then run this file again."
  echo
  exit 1
fi

URL="http://localhost:__PORT__/"
(command -v open >/dev/null 2>&1 && open "$URL") \
  || (command -v xdg-open >/dev/null 2>&1 && xdg-open "$URL") \
  || echo "  Open this in your browser:  $URL"

node serve.js
