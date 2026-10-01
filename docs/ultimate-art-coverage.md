# Attack and ultimate atlases

All 614 character atlases in `public/art/characters/` remain the normal attack
art. The 613 corresponding atlases in `public/art/characters/ultimates/` are
used for ultimates. Gear 5 is the exception: its existing character atlas stays
the ultimate, and `public/art/characters/attacks/luffy5.png` supplies its new
normal attack.

Every new atlas is 768×192 pixels with four 192×192 cells. Cell 0 is copied
pixel for pixel from the original character atlas. Cells 1–3 contain new
action poses, so a character keeps the same idle image in both animations.
The full-resolution generated sources are in `docs/ultimate-art-sources/`.

`scripts/update-ultimate-manifest.mjs` registers the available ultimate
atlases for the runtime and runs during `npm run dev` and `npm run build`.
After editing or adding art, run:

```sh
python3 scripts/verify-ultimate-atlases.py
npm run build
```

The verifier checks coverage, four nonempty cells, exact cell 0 equality, and
differences among the three action cells. The build refreshes the offline asset
list, which includes all 613 ultimate atlases and the Gear 5 normal attack.
