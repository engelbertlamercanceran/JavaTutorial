# HACKO — Java Learning Game

A game-based Java course for beginners. Ten missions from variables through
nested loops, each one a small playable game, tied together by a mission map
with badges and XP.

## Stack

Static HTML with a small shared layer. No build step, no bundler, no backend,
no database, no dependencies.

```
hack/
  shared/          one palette, one save file, one sound engine
    hacko.css      design tokens + HUD, modal, button, progress components
    audio.js       synthesised retro sound effects (no audio files)
    storage.js     accounts, progress, autosave, export/import
    hint.js        tiered hints + a guard against leaking answers
    javaloop.js    runs the Java the loop missions teach, and diffs output
  tools/           node checks, see Testing
  Badges/          the ten mission badges
  login.html       pick a player
  map.html         mission map - the way in to every game
  <mission>.html   the games
```

## Running it

```bash
python -m http.server 8000
# then open http://localhost:8000/login.html
```

Start at **login.html**, not at a game. The map needs a signed-in player, and
the games report their progress back to it.

Individual games still open by double-clicking, but they will not record
progress that way.

## The missions

| # | Mission | Topic | File |
| --- | --- | --- | --- |
| 1 | The Escape Room | Variables and data types | `theescaperoom.html` |
| 2 | The Secret Message | Input / output | `thesecretmessage.html` |
| 3 | Conditional Challenge | If-else | `conditionalchallenge.html` |
| 4 | Loop Labyrinth | Loops | `looplabyrinth.html` |
| 5 | Array Adventure | Arrays | `arrayadventure.html` |
| 6 | Function Fortress | Methods | `functionfortress.html` |
| 7 | Debugging Duel | Debugging | **not built** - prototype in `aa/` |
| 8 | Classroom Rescue | Classes and objects | `classroomrescue.html` |
| 9 | Conditional Labyrinth II | Nested conditionals | **not built** |
| 10 | Loop Dungeon - The Pattern Boss | Nested loops | `loopboss.html` |

`aa/` holds a working Debugging Gym prototype — ten bug-trainer duels ending in
a boss fight. It is the intended basis for mission 7 but is not wired into the
map yet.

## How progress works

Everything lives under one key per player:

```
hacko:users       -> ["maria", "jun"]
hacko:active      -> "maria"
hacko:user:maria  -> { totalXP, missions: { 5: { levelsDone, resumeLevel, ... } } }
```

- **Accounts** — several students can share a machine without overwriting each
  other. The sign-in has no password and is *not* a security feature.
- **The 70% gate** — a mission unlocks once the previous one is 70% cleared
  (7 of 10 levels), so a student stuck near the end is not blocked. The badge
  and full XP still need all 10. The threshold is one constant,
  `UNLOCK_THRESHOLD` in `shared/storage.js`.
- **Resume** — every cleared level is saved as it happens, and `pagehide` /
  `visibilitychange` record the level in progress. Leaving and coming back drops
  the player at the start of the level they had reached.
- **Export / import** — `login.html` can download a player's progress as JSON
  and restore it. This is the only way to move between machines.

### Offline only, on purpose

Progress lives in one browser on one computer. A student on a different PC
starts fresh, a wiped lab machine loses everything, and no teacher can see class
progress. Export/import is the workaround, and it depends on students
remembering to export.

Adding a server later means changing one file — `shared/storage.js` — and
nothing else.

## Testing

```bash
node tools/test-all.js
```

| Check | What it guards |
| --- | --- |
| `test-shared.js` | accounts, the 70% gate, resume, migration, and that no hint contains its own answer |
| `check-mazes.js` | flood-fills every Loop Labyrinth maze — start must reach exit, gate and all cores |
| `check-items.js` | every Array Adventure item is distinguishable, and every silhouette draws |
| `check-java.js` | lesson content is Java; correct answers pass and starter skeletons do not |
| `check-jumps.js` | every Escape Room pickup is reachable, flagging anything above 70% of a perfect double jump |
| `test-javaloop.js` | the Java interpreter: same output from different code must always pass |
| `check-shields.js` | every Loop Dungeon shield is beatable with real Java, and no starter already wins |
| `check-wiring.js` | games load the shared modules, report to the map, resume after boot, carry music, and every badge exists |

Run `check-mazes.js` after editing any maze and `check-java.js` after editing
any lesson. Both catch classes of bug that shipped unnoticed before.

## Conventions worth keeping

- **Hints never contain their answer.** Three tiers: nudge, structure, then a
  worked example using *different* values. `HackoHint.leaks()` blocks a leaking
  hint at runtime and `test-shared.js` fails the build.
- **Starter code is a skeleton, never the solution.** Several games used to
  pre-fill the finished answer, so pressing RUN won instantly.
- **Lesson content is Java.** Four games previously taught PHP or JavaScript.
  `check-java.js` scans the text players actually see.
- **Run the code, do not pattern-match the source.** Mission 10 regex-matched
  what the player typed, so a correct answer in an unexpected shape was
  rejected with no useful explanation. `shared/javaloop.js` executes it and
  diffs the output instead, which is why any working solution now passes.
- **Items differ by shape as well as colour**, so the games work for
  colour-blind players.
- **Sound is synthesised**, not sourced. Add new effects to the `SFX` table in
  `shared/audio.js` and new background tracks to `TRACKS` — no audio files
  anywhere. Every page carries a quiet background track, movement sounds and a
  fixed **SOUND ON / OFF** button so a player can always tell whether audio is
  working.
- **Never schedule a note at `currentTime + 0`.** A suspended AudioContext
  reports `currentTime` as 0, so those notes land in the past once it starts and
  are dropped — which silenced the whole suite once. `shared/audio.js` queues
  anything requested before the first gesture and replays it on unlock.

## Known gaps

- Classroom Rescue is a single room. The client asked for a Pokémon-gym-style
  multi-room escape; the concept conflicts with the spec's "Classes and Objects"
  brief for mission 8 and needs a decision before building.
- Lives still work three different ways across the suite: hard game-over at 0
  (missions 1-3), HP only with no lives (4-6), and lives that silently reset
  with an XP penalty (8, 10).
- `dashboard.html` still reads the old `hackoProgress` key and has not been
  moved onto the shared store.
- `.removed/` holds six dead files — duplicates, a broken stub and two empty
  files — kept aside rather than deleted. Safe to remove permanently.
