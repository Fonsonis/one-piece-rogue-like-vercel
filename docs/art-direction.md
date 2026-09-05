# Dex art and combat presentation

The visual layer follows the Luffy Run minigame: outlined pixel characters, readable silhouettes, a deep blue interface, sea blue surfaces, and warm gold actions. Every one of the 457 database IDs has its own generated character atlas, including evolved forms, minor enemies and crossover characters.

Each RGBA atlas contains four 192 × 192 cells in this order: guard, windup, characteristic attack, and recoil. Poses share a scale and a ground anchor within each character. Still portraits are derived from the guard pose with a tighter crop for small menu and Dex icons. `public/art/manifest.json` records exact file hashes and pose bounds; the production review is recorded in `dex-art-review.json`.

`public/art/visuals.js` replaces the character icon renderer and wraps attacks only to display animations. The original attack runs once, synchronously, with its original arguments and return value. The visual layer does not consume `Math.random`, edit fighter statistics, change cooldowns, delay turns, change rewards, unlock Dex entries, or write saves. An animation API failure is contained within the presentation layer. The original `public/game.js`, `public/data.js`, account backend and Luffy Run engine remain byte-for-byte unchanged.

Combat plays the character's windup and attack poses, and the defender's recoil only when HP decreases. Hit effects use the actual move type; ultimate and healing effects have distinct emphasis. Splash damage also triggers recoil on affected teammates. A character sheet can replay its attack without starting a battle or changing the character. The reduced-motion preference disables continuous movement and transient effects.

The existing discovery system remains in force: unseen Dex cards keep their question mark. The art files cover the entire database, but the game still reveals each character at the same point in the original progression.

`tests/art-presentation.test.mjs` compares 2,239 real attack and ultimate scenarios against the original engine, including RNG consumption, HP, charge, status effects, logs and persistent state. It also checks inaccessible-animation fallback, discovery behavior and complete unique atlas coverage. The original game and runner tests cover saves, map content and minigame physics. These are source/runtime checks; browser visual testing was not part of this change.
