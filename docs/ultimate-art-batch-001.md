# Ultimate art batch 001

Ten new sheets were generated with the built-in `image_gen` edit tool, using
each corresponding `public/art/characters/<id>.png` as the image reference.
Full-resolution outputs are in `docs/ultimate-art-sources/<id>.png`. They were
packed with `python3 scripts/import-ultimate-poses.py <id>
docs/ultimate-art-sources/<id>.png` into
`public/art/characters/ultimates/<id>.png`. No original attack atlas changed.

## Shared prompt for Abdullah through Aladine

> Use case: precise-object-edit. Asset type: NEW four-pose pixel-art ultimate combat sprite sheet. Edit the supplied character atlas as identity/style reference. Preserve the exact costume, face, body proportions, pixel texture and transparent alpha. Four isolated full-body poses left-to-right: guard, new windup, dramatic new impact pose, recovery. Feet share a baseline; consistent scale; generous clear transparent gutters; every limb and weapon stays inside its own quarter of the wide image. The impact must have a changed body silhouette and action, not just color or added energy. No aura, halo, recolor, old attack pose, giant abstract effect, text, labels, borders, background or watermark.

The corresponding character sentence was appended verbatim:

- **abdullah:** Abdullah: large cheerful fighter in striped red-white pants, white head cloth, sleeveless vest and two curved scimitars. Ultimate: leap upward with both knees bent and cross both swords downward in an X-shaped double cut; show a clearly different airborne impact stance.
- **absalom:** Absalom: long blond hair, black top hat and dark long coat, rugged trousers and arm-mounted gun. Ultimate: lunging crouch with one arm cannon braced and the other arm swinging forward for a close-range blast; body turns three-quarter view and coat whips outward. Keep gun hardware physically attached.
- **ace:** Ace: black hair, orange brimmed hat, bare chest, blue shorts, necklace. Ultimate Dai Enkai: both arms lift overhead to form a compact burning fireball, then he steps into a two-handed downward throw. Show the overhead lift and bent-body release as physical poses; flame belongs to his hands, with no free-floating aura.
- **aisa:** Aisa: small red-haired girl in a cream rabbit-eared hood, pink patterned dress, tiny white wings and satchel. Ultimate: a quick airborne spinning palm strike, with a visible jump and complete turn of torso; feet leave the ground in the impact frame. Keep her small child proportions and costume.
- **akainu:** Akainu: stern tall Marine admiral with white Marine cap, red double-breasted suit and white gold-epaulette cape. Ultimate Daifunka: plant feet wide, raise one enlarged magma fist above shoulder, then drive it diagonally downward with a full torso bend and cape flying. The magma is attached to the fist, not a free-floating aura.
- **aladine:** Aladine: blue-skinned merman with dark long hair, yellow vest, red chest emblem, blue fish tail and silver trident. Ultimate: coil the tail and lift the trident overhead, then perform a lunging diagonal trident sweep with torso twist and tail uncoiling. Show the full trident and tail in each pose.

## Direct prompts for Alvida through Ange

> **alvida:** Use case: precise-object-edit. NEW four-pose transparent pixel-art ultimate combat sprite sheet for Alvida. Edit her current sheet as identity/style reference. Preserve stout build, long black curly hair, pink cowboy hat, pink plaid shirt, dark pants, red cape and heavy spiked iron club. Four full-body isolated poses left to right: guard, torso turned with heavy club raised high in both hands, a new broad overhead hammer swing with deep forward lunge and club crashing toward ground, recovery. Show weight and follow-through with different limb and torso silhouettes. Same baseline and character size; clear transparent gutter between quarter-width panels; all limbs and weapon tips fully inside each panel. No aura, halo, recolor, reused old attack, abstract effects, background, words or borders.

> **amande:** Use case: precise-object-edit. NEW four-pose transparent pixel-art ultimate combat sprite sheet for Amande. Edit her current sheet as identity/style reference. Preserve teal short hair, wide purple feathered hat, purple striped dress, white spotted cape and long slender sword. Four isolated full-body poses left to right: balanced fencing guard, high vertical sword windup with a backward step, a new long low fencing lunge with a downward diagonal cut and torso bent forward while cape and skirt follow, poised recovery. The impact pose must differ clearly from her normal sideways slash. Consistent size, same baseline and clear transparent gutters between four equal-width panels. Every limb and sword tip remains inside its panel. No aura, halo, simple recolor, recycled attack pose, abstract effects, background, words or borders.

> **anana:** Use case: precise-object-edit. NEW four-pose transparent pixel-art ultimate combat sprite sheet for Anana. Edit her current sheet as identity/style reference. Preserve small youthful proportions, long pink hair, frilly pink dress, yellow shoes, a little rabbit toy held in one arm and a short knife in the other. Four isolated full-body poses: guard holding rabbit, low twisting windup, an airborne spinning knife strike with one foot lifted and full torso rotation while retaining the rabbit, balanced landing/recovery. Make the impact body silhouette and blade direction clearly different from her normal straight slash. Keep same baseline, consistent scale and generous transparent gaps between four equal-width panels; all parts stay inside each panel. No aura, halo, simple recolor, recycled attack pose, abstract effects, background, text or borders.

> **ange:** Use case: precise-object-edit. NEW four-pose transparent pixel-art ultimate combat sprite sheet for Ange. Edit her current sheet as identity/style reference. Preserve long light hair, cream dress and dark skirt, double-headed battle axe and round shield. Four isolated full-body poses from left to right: guard, low defensive crouch behind shield while drawing axe back, NEW forceful shield-first forward leap into a rising overhead axe cut with one leg raised and full body tilted, landing recovery. The impact body silhouette must differ clearly from her normal standing sideways slash. Same baseline, consistent size, four clear transparent quarter-width cells; every axe tip, shield and limb inside the pose's cell. No aura, halo, simple recolor, recycled attack pose, abstract effects, background, text or borders.

## QA

All ten packed sheets were visually reviewed at 768×192. Each has a first
cell copied pixel for pixel from its original attack atlas, followed by three
transparent, fully contained animation poses and a new impact body action.
Dimensions, transparency, per-cell alpha bounds and difference from the
original attack sheet were checked programmatically. Image generation failed
once for the four parallel requests due to a connection error; retrying those
characters sequentially succeeded without replacing any accepted image.
