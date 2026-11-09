#!/bin/sh
# Build the zip to upload to the Chrome Web Store: dist/speed-controller-<version>.zip
set -eu

cd "$(dirname "$0")/.."

version=$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')
out="dist/speed-controller-$version.zip"

mkdir -p dist
rm -f "$out"
zip -q -X "$out" \
  manifest.json \
  settings.js content.js \
  popup.html popup.css popup.js \
  icons/icon16.png icons/icon48.png icons/icon128.png

echo "$out"
