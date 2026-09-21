# Android rendering review

Reviewed against `origin/main` at `f9631f4` (PR #100), including native saves,
APK updates, mobile map navigation and the recent combat UI changes.

## Changes

- Combat refreshes keep existing reserve buttons, sprites, XP, statistics,
  passives and synergy markup when their source values have not changed.
  HP, status, buffs, KO, Ultimate charge and relay availability still update
  synchronously. WeakMap caches expire with the rendered screen and compare
  source strings rather than emoji-decorated HTML.
- The ocean scrolls two independently repeating texture layers using compositor
  translations. Each is limited to the viewport plus one texture period, rather
  than the height of the entire world. Drift, foam, dark mode and reduced motion
  remain intact. Older WebViews retain the original background-position path.
- Combat calculations, RNG, timers, progression, saves and native updater logic
  are unchanged. The generated offline manifest includes the new assets.

## Measurements

Headless desktop Chrome, 390 × 844, device scale 2, CPU slowed 4×, 40 refreshes
with six allies and six enemies. These are renderer measurements, **not Android
hardware FPS or a guarantee of the same improvement on a phone**.

| Work | Before | After |
| --- | ---: | ---: |
| Unchanged refresh, median | 7.9 ms | 0.1 ms |
| HP/Ultimate refresh, median | 7.7 ms | 4.5 ms |
| Added DOM nodes over 40 HP refreshes | 10,440 | 80 |
| Layouts over 40 HP refreshes | 82 | 41 |
| Map scroll frame interval, median | 16.7 ms | 16.7 ms |

A separate isolated-ocean trace at 390 × 844, without CPU throttling, recorded
180 Paint events using the original backgrounds versus 120 with the translated
layers over 60 scroll frames. This reduces painting work; desktop map FPS was
already limited by the display refresh rate.

## Verification

- 308 existing Node tests passed; lint and static production build passed.
- Capacitor Android sync passed after installing locked dependencies.
- Browser combat regression covered the backpack, item consumption, keyboard
  navigation and mobile layout. Incremental rendering matched a full render for
  buffs, XP, statuses, KO and pause/resume state.
- Ocean screenshots compared light/dark themes, texture boundaries, long and
  reverse scroll. Mean channel difference stays below 1% of the 0–255 range;
  small composited texture rasterization differences are allowed.
- No physical Android device was attached. A native APK build and on-device
  combat/map testing remain separate from these local checks.

Run the browser checks against the static dev server on port 4190 with Chrome
and Playwright installed (or set `PLAYWRIGHT_MODULE` to its absolute module path):

```sh
node tests/browser-render-performance.mjs --verify
node tests/browser-ocean-performance.mjs
TEST_URL=http://127.0.0.1:4190/ node tests/browser-combat-shortcuts.mjs
```

The benchmark writes ignored JSON reports under `outputs/android-performance/`.
Use `BENCH_LABEL` to select a report name and `TEST_URL` to use another server.
