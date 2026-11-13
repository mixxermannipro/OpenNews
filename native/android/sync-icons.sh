#!/usr/bin/env bash
set -euo pipefail

resources=android/app/src/main/res
logo=public/pwa-512x512.png
image_tool=magick
if ! command -v "$image_tool" >/dev/null; then
  image_tool=convert
fi

for density_and_size in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  density=${density_and_size%:*}
  size=${density_and_size#*:}
  directory="$resources/mipmap-$density"
  layer_size=$((size * 9 / 4))
  logo_size=$((size * 3 / 2))
  center=$(awk -v size="$size" 'BEGIN { print size / 2 - 0.5 }')

  "$image_tool" "$logo" -resize "${size}x${size}" "$directory/ic_launcher.png"
  "$image_tool" "$directory/ic_launcher.png" -alpha set \
    \( -size "${size}x${size}" xc:none -fill white \
       -draw "circle $center,$center $center,0" \) \
    -compose DstIn -composite "$directory/ic_launcher_round.png"

  # Android masks the center of the larger adaptive layer.
  "$image_tool" "$logo" -resize "${logo_size}x${logo_size}" -gravity center \
    -background '#020204' -extent "${layer_size}x${layer_size}" \
    "$directory/ic_launcher_foreground.png"
done
