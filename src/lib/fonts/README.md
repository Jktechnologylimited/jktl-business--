# Bundled Fraunces

`fraunces-variable.ttf` is the normal variable Fraunces typeface from the official Google Fonts repository:
https://github.com/google/fonts/tree/main/ofl/fraunces

Original file: `Fraunces[SOFT,WONK,opsz,wght].ttf`.
License: SIL Open Font License 1.1, included in `OFL-Fraunces.txt`.

Loaded using `next/font/local` with the existing `--font-fraunces` variable and 500–600 weight range. This bypasses the Google font URL import-map error reported by Turbopack on Vercel. Existing font-pair identifiers and customer selections remain unchanged.

## Bundled Space Grotesk

`space-grotesk-variable.ttf` is the unmodified normal variable font from
https://github.com/google/fonts/tree/main/ofl/spacegrotesk (`SpaceGrotesk[wght].ttf`).
Its SIL Open Font License 1.1 is in `SPACE-GROTESK-OFL.txt`.

Space Grotesk encountered the same Turbopack Google font import-map error during local production verification. Loading it through `next/font/local` preserves the existing 500–600 weights, `--font-space-grotesk` variable and Modern font-pair identifier.

## Bundled Playfair Display and Poppins

The unchanged official files from
https://github.com/google/fonts/tree/main/ofl/playfairdisplay and
https://github.com/google/fonts/tree/main/ofl/poppins are bundled as:

- `playfair-display-variable.ttf` — `PlayfairDisplay[wght].ttf`, loaded at the existing 600–700 weights and `--font-playfair-display` variable.
- `poppins-regular.ttf`, `poppins-medium.ttf`, `poppins-semibold.ttf` — the existing 400, 500 and 600 normal weights, using `--font-poppins`.

Their SIL Open Font License 1.1 texts are included as `PLAYFAIR-DISPLAY-OFL.txt`
and `POPPINS-OFL.txt`. The local files avoid the Google response URL format that
caused `next/font` to fail when extracting font-file extensions during production
validation. Existing font-pair IDs and template selections are unchanged.
