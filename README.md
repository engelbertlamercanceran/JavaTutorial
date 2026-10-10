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
    loading.js     the start-up loading screen, shown once per session
  tools/           node checks, see Testing
  Badges/          the ten mission badges
  login.html       pick a player
  map.html         mission map - the way in to every game
  certificate.html printable certificate, unlocked by finishing all 10 missions
  <mission>.html   the games
```

## Running it

Double-click **login.html**. Nothing needs a server: there is no build step and
nothing is fetched, so the pages run straight from disk.

Start at **login.html**, not at a game. The map needs a signed-in player, and
the games report their progress back to it. A game opened directly, with no one
signed in, still plays but records nothing.

A local server also works, and is handy while editing:

```bash
npx http-server -p 8000          # Node
python -m http.server 8000       # or Python
# then open http://localhost:8000/login.html
```

In VS Code, the free **Live Server** extension does the same: open the whole
folder, then right-click `login.html` > *Open with Live Server*. It reloads the
page on every save, which restarts the current level.

## The missions

| # | Mission | Topic | File |
| --- | --- | --- | --- |
| 1 | The Escape Room | Variables and data types | `theescaperoom.html` |
| 2 | The Secret Message | Input / output | `thesecretmessage.html` |
| 3 | Conditional Challenge | If-else | `conditionalchallenge.html` |
| 4 | Loop Labyrinth | Loops | `looplabyrinth.html` |
| 5 | Array Adventure | Arrays | `arrayadventure.html` |
| 6 | Function Fortress | Methods | `functionfortress.html` |
| 7 | Debugging Duel | Debugging | `aa/debugging.html` |
| 8 | Classroom Rescue | Classes and objects | `classroomrescue.html` |
| 9 | Conditional Labyrinth II | Nested conditionals | `conditionallabyrinth.html` |
| 10 | The Loop Master | for / while / do-while | `loopboss.html` |

Mission 7 lives in `aa/`: the Debugging Gym, ten bug-trainer duels ending in a
boss fight. It is the one game outside the root folder, so its pages load the
shared modules from `../shared/`.

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
- **Export / import** — on `login.html`, clicking a player selects them (it no
  longer signs straight in); PLAY or DOWNLOAD then act on that named player.
  Download saves their progress as JSON, and restore loads it back. This is the only way to move between machines.

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
| `check-escape.js` | plays every Escape Room level with the game's physics - solid furniture, live floor and all - and proves every pickup and the vault door can be reached without touching a corrupted chip (levels 8-10), and that each corrupted chip is close enough to the route to be a threat |
| `check-classroom.js` | walks each of Classroom Rescue's ten rooms around the solid furniture and proves every character, item and the exit can be reached - from a spot off the lockdown bugs' patrol lines - that no bug walks through furniture, the start is clear of them, and no two rooms are alike |
| `check-labyrinth.js` | every Conditional Labyrinth maze: all gates reachable, nothing sealed off, hearts and sentries placed fairly, bricks only on open floor away from the start, bombs reachable without bombing anything, drones starting far away, no two levels alike |
| `check-secret.js` | The Secret Message's per-level spawn: on a floor, off clues and patrol lines, room to move before the first guard, every clue, the door and the exit reachable |
| `check-challenge.js` | every Conditional Challenge maze: right size, walled in, nothing sealed off, clues and bomb reachable, birds nest away from the start, no two levels alike |
| `check-arrays.js` | every Array Adventure map: items and portal reachable without stepping on spikes, each mission keeps its item/trap/glitch counts, glitches start away from Hacko, no glitch lane without places to dodge, and no glitch patrolling the only tunnel into the portal |
| `check-fortress.js` | every Function Fortress stage: each hop inside Hacko's jump (moving platforms and the jump pad included), sentries clear of the start, and the door ledge out of reach until the program runs |
| `test-javaloop.js` | the Java interpreter: same output from different code must always pass |
| `check-shields.js` | every Loop Master phase and every round of the phase 10 finale is beatable, a hardcoded count fails the while phases and rounds, and a while loop loses the do-while ones |
| `check-wiring.js` | games load the shared modules, report to the map, resume after boot, carry music, and every badge exists |

Run `check-mazes.js` after editing any maze, `check-escape.js` after editing
an Escape Room level, `check-classroom.js` after moving classroom furniture,
`check-secret.js`, `check-challenge.js`, `check-arrays.js` or
`check-fortress.js` after editing those games' levels, and `check-java.js`
after editing any lesson. Both catch classes of bug that shipped unnoticed before.

## Conventions worth keeping

- **Hints never contain their answer.** Three tiers: nudge, structure, then a
  worked example using *different* values. `HackoHint.leaks()` blocks a leaking
  hint at runtime and `test-shared.js` fails the build.
- **Badges are one medal design**, drawn as SVG by `shared/badgeart.js` in
  the style of Dota 2 rank medals. The emblem shows the topic; the metal shows
  progress (bronze, silver, gold, emerald, divine, immortal). The PNGs in
  `Badges/` are only a fallback.
- **The certificate needs every level of all ten missions** - the same 100%
  as the badges. `HackoStore.certificate()` enforces it, so the page cannot be
  reached by typing its address.
- **Hints cost hint points**, in the four games where a hint can teach
  without answering (4, 8, 9, 10). Start with 3, earn 1 per level cleared in
  those games, 1 point per tier, and a bought tier stays free. Kept apart from
  XP so buying help never lowers the score. Use `HackoHint.paid()`; the rules
  live in `HINT POINTS` in `shared/storage.js`.
- **Starter code is a skeleton, never the solution.** Several games used to
  pre-fill the finished answer, so pressing RUN won instantly. Classroom
  Rescue goes further at the client's request: each mission starts with
  nearly-right code (a missing semicolon, a typo, lines out of order) for the
  player to fix - still never passing as it stands.
- **Lesson content is Java.** Four games previously taught PHP or JavaScript.
  `check-java.js` scans the text players actually see.
- **Run the code, do not pattern-match the source.** Mission 10 regex-matched
  what the player typed, so a correct answer in an unexpected shape was
  rejected with no useful explanation. `shared/javaloop.js` executes it and
  diffs the output instead, which is why any working solution now passes.
- **Items differ by shape as well as colour**, so the games work for
  colour-blind players.
- **Three lives on every level, and running out drops the player back one
  level.** Lives reset to 3 whenever a level loads - they used to carry across
  all ten levels of a mission. Use `HackoStore.loseAllLives(mission, level)`,
  which restores the lives and returns the level to load. Three missions
  previously had no lives at all and simply restarted forever.
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

- Classroom Rescue now has a different room on every level, with patrolling
  bugs from level 2 and a hunting bug from level 6. The client's earlier
  Pokémon-gym-style multi-room escape is still not built; it conflicts with
  the spec's "Classes and Objects" brief for mission 8 and needs a decision.
- `dashboard.html` still reads the old `hackoProgress` key and has not been
  moved onto the shared store.
- `.removed/` holds six dead files — duplicates, a broken stub and two empty
  files — kept aside rather than deleted. Safe to remove permanently.
