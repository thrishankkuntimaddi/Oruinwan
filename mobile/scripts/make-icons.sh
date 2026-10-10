#!/usr/bin/env bash
# Renders the Android launcher icons and launch-screen logo from the master logo
# (client/public/icons/Oruinwan.png). Needs ImageMagick 7 (`magick`). Run after changing the logo.
set -euo pipefail
cd "$(dirname "$0")/.."

MASTER=../client/public/icons/Oruinwan.png
RES=android/app/src/main/res
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# The glossy figure without the master's black square around it.
magick "$MASTER" -fuzz 3% -trim +repage "$TMP/art.png"

# density → [legacy icon px, adaptive layer px (108dp)]
declare -A LEGACY=([mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192)
declare -A LAYER=([mdpi]=108 [hdpi]=162 [xhdpi]=216 [xxhdpi]=324 [xxxhdpi]=432)

for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  dir="$RES/mipmap-$d"
  mkdir -p "$dir"
  l=${LEGACY[$d]}
  a=${LAYER[$d]}
  # Adaptive icon (Android 8+): the art fits the 66dp safe circle of the 108dp layer.
  art=$((a * 586 / 1000))
  magick -size ${a}x${a} xc:none \( "$TMP/art.png" -resize ${art}x${art} \) -gravity center -composite -strip -depth 8 "$dir/ic_launcher_foreground.png"
  magick -size ${a}x${a} xc:'#000000' -strip -depth 8 "$dir/ic_launcher_background.png"
  # Legacy square and round icons (Android 7).
  inner=$((l * 78 / 100))
  r=$((l * 22 / 100))
  magick -size ${l}x${l} xc:'#000000' \( "$TMP/art.png" -resize ${inner}x${inner} \) -gravity center -composite -alpha set \
    \( -size ${l}x${l} xc:none -fill white -draw "roundrectangle 0,0 $((l - 1)),$((l - 1)) $r,$r" \) -compose DstIn -composite -strip -depth 8 "$dir/ic_launcher.png"
  magick -size ${l}x${l} xc:'#000000' \( "$TMP/art.png" -resize ${inner}x${inner} \) -gravity center -composite -alpha set \
    \( -size ${l}x${l} xc:none -fill white -draw "circle $((l / 2)),$((l / 2)) $((l / 2)),0" \) -compose DstIn -composite -strip -depth 8 "$dir/ic_launcher_round.png"
done

# Launch screen logo for Android 11 and older (drawable/splash.xml centres it on #0c0c0c).
mkdir -p "$RES/drawable-nodpi"
magick -size 504x504 xc:'#000000' \( "$TMP/art.png" -resize 414x414 \) -gravity center -composite -alpha set \
  \( -size 504x504 xc:none -fill white -draw 'roundrectangle 0,0 503,503 112,112' \) -compose DstIn -composite \
  -quality 86 -define webp:alpha-quality=90 "$RES/drawable-nodpi/splash_logo.webp"

# Favicon for the browser preview.
magick -size 192x192 xc:'#000000' \( "$TMP/art.png" -resize 150x150 \) -gravity center -composite -strip -depth 8 public/icon-192.png
echo "Icons written to $RES"
