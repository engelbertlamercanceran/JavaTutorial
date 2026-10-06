/* =========================================================
   HACKO - tools/check-escape.js

   Plays every Escape Room level with the game's own physics
   and proves it can be finished: from the spawn, Hacko can
   reach every data pickup and then the vault door.

   check-jumps.js only measures the height of each pickup.
   That stopped being enough once the furniture became solid
   (a desk can sit between Hacko and a pickup) and levels 8-10
   electrified the floor (every gap must be crossed on the
   platforms). This one actually jumps.

   It reads LEVELS and the furniture helpers straight out of
   theescaperoom.html, so it always checks the real data.

   Every jump is tried from every standing spot, holding left,
   right or nothing, with the second jump fired on each frame
   of the flight. A hop counts if some start spot lands it
   with a timing window of at least MIN_WINDOW frames - a jump
   that works on exactly one frame is not one a student will
   find. Drones and lasers move, so they are not part of the
   check; they make the level harder, not impossible.

       node tools/check-escape.js
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var GAME = path.join(__dirname, "..", "theescaperoom.html");

/* physics, read from updatePhysics() */
var GRAVITY = 0.92;
var JUMP_V = 16.5;
var RUN = 6.5;
var FRICTION = 0.86;
var W = 64;
var H = 64;
var HEIGHT = 560;
var PICKUP_R2 = 1300;
var SPAWN = { x: 120, y: 200 };

var MIN_WINDOW = 3;
var STEP = 8;

var failed = 0;
var passed = 0;


function loadGame() {

    var source = fs.readFileSync(GAME, "utf8");
    var from = source.indexOf("const TYPE_COLORS");
    var to = source.indexOf("/* end of level data");

    if (from === -1 || to === -1) {
        throw new Error("could not find the level data in " + GAME);
    }

    var code = source.slice(from, to) +
        "\n;({ LEVELS, settleFurniture, furnitureSolids })";

    return vm.runInNewContext(code, { Math: Math });
}


function overlaps(ax, ay, aw, ah, b) {
    return ax < b.x + b.w && ax + aw > b.x &&
        ay < b.y + b.h && ay + ah > b.y;
}


/* One flight. Mirrors updatePhysics(): friction, input,
   gravity, move, clamp, platforms (one-way), then solids. */
function fly(world, x, y, dir, secondAt, walkOff) {

    var vx = 0;
    var vy = walkOff ? 0 : -JUMP_V;
    var touched = [];

    for (var frame = 1; frame < 260; frame++) {

        vx *= FRICTION;

        if (dir) {
            vx = dir * RUN;
        }

        if (frame === secondAt) {
            vy = -JUMP_V;
        }

        var px = x;
        var py = y;

        vy += GRAVITY;
        x += vx;
        y += vy;

        x = Math.max(0, Math.min(x, world.maxX));

        var landed = null;
        var i;
        var p;

        for (i = 0; i < world.platforms.length; i++) {

            p = world.platforms[i];

            var over = x + W > p.x && x < p.x + p.w;

            if (over && vy >= 0 && py + H <= p.y && y + H >= p.y) {
                y = p.y - H;
                vy = 0;
                landed = p.y;
            }

            if (!(y + H > p.y && y < p.y + p.h)) {
                continue;
            }

            if (px + W <= p.x && x + W > p.x) {
                x = p.x - W;
                vx = 0;
            }

            if (px >= p.x + p.w && x < p.x + p.w) {
                x = p.x + p.w;
                vx = 0;
            }
        }

        for (i = 0; i < world.solids.length; i++) {

            var s = world.solids[i];
            var across = x + W > s.x && x < s.x + s.w;

            if (across && vy >= 0 && py + H <= s.y && y + H >= s.y) {
                y = s.y - H;
                vy = 0;
                landed = s.y;
            }

            if (across && vy < 0 && py >= s.y + s.h && y < s.y + s.h) {
                y = s.y + s.h;
                vy = 0;
            }

            if (!(y + H > s.y && y < s.y + s.h)) {
                continue;
            }

            if (px + W <= s.x && x + W > s.x) {
                x = s.x - W;
                vx = 0;
            } else if (px >= s.x + s.w && x < s.x + s.w) {
                x = s.x + s.w;
                vx = 0;
            }
        }

        for (i = 0; i < world.electric.length; i++) {
            if (overlaps(x, y, W, H, world.electric[i])) {
                return null;
            }
        }

        if (y > HEIGHT + 80) {
            return null;
        }

        world.pickups.forEach(function (item, index) {
            var dx = x + W / 2 - (item.x + 22);
            var dy = y + H / 2 - (item.y + 22);
            if (dx * dx + dy * dy < PICKUP_R2 && touched.indexOf(index) === -1) {
                touched.push(index);
            }
        });

        if (landed !== null && frame > 1) {
            return { x: x, y: landed, touched: touched };
        }
    }

    return null;
}


/* Every spot Hacko can stand, grouped into walkable stretches:
   the top of each platform and each solid, minus anywhere the
   body would be inside furniture or touching a live floor. */
function standingSegments(world) {

    var tops = world.platforms.concat(world.solids);
    var segments = [];

    tops.forEach(function (top) {

        var run = null;

        for (var x = Math.max(0, top.x - W + 1); x < top.x + top.w; x += STEP) {

            var y = top.y - H;
            var ok = x <= world.maxX &&
                !world.solids.some(function (s) { return overlaps(x, y, W, H, s); }) &&
                !world.electric.some(function (e) { return overlaps(x, y, W, H + 1, e); });

            if (ok) {
                if (!run) {
                    run = { y: top.y, xs: [] };
                    segments.push(run);
                }
                run.xs.push(x);
            } else {
                run = null;
            }
        }
    });

    return segments;
}


function segmentAt(segments, x, y) {

    var best = -1;
    var bestGap = Infinity;

    segments.forEach(function (seg, index) {

        if (seg.y !== y) {
            return;
        }

        var lo = seg.xs[0] - STEP;
        var hi = seg.xs[seg.xs.length - 1] + STEP;

        if (x >= lo && x <= hi) {
            var gap = Math.abs(x - (lo + hi) / 2);
            if (gap < bestGap) {
                bestGap = gap;
                best = index;
            }
        }
    });

    return best;
}


function checkLevel(game, level) {

    var interactives = game.settleFurniture(level.interactives, level.platforms);

    var world = {
        platforms: level.platforms,
        solids: [].concat.apply([], interactives.map(game.furnitureSolids)),
        electric: (level.hazards || []).filter(function (h) {
            return h.type === "electric";
        }),
        pickups: level.collectibles,
        maxX: level.terminalX - W
    };

    var segments = standingSegments(world);

    /* where Hacko lands after spawning */
    var spawn = fly(world, SPAWN.x, SPAWN.y, 0, 0, true);

    if (!spawn) {
        return ["spawn lands on nothing safe"];
    }

    var start = segmentAt(segments, spawn.x, spawn.y);

    /* best timing window found for each hop and each pickup,
       then the widest path out of the spawn */
    var edges = segments.map(function () { return {}; });
    var grabs = segments.map(function () { return {}; });

    segments.forEach(function (seg, from) {

        seg.xs.forEach(function (x) {

            [-1, 0, 1].forEach(function (dir) {

                var lands = {};
                var takes = {};

                for (var second = 0; second <= 44; second++) {

                    /* 0 means no second jump */
                    var at = second === 0 ? -1 : second + 1;
                    var result = fly(world, x, seg.y - H, dir, at, false);

                    if (!result) {
                        continue;
                    }

                    var to = segmentAt(segments, result.x, result.y);

                    if (to !== -1) {
                        lands[to] = (lands[to] || 0) + 1;
                    }

                    result.touched.forEach(function (index) {
                        takes[index] = (takes[index] || 0) + 1;
                    });
                }

                Object.keys(lands).forEach(function (to) {
                    edges[from][to] = Math.max(edges[from][to] || 0, lands[to]);
                });

                Object.keys(takes).forEach(function (index) {
                    grabs[from][index] = Math.max(grabs[from][index] || 0, takes[index]);
                });
            });

            /* standing pickups - walk along the stretch */
            world.pickups.forEach(function (item, index) {
                var dx = x + W / 2 - (item.x + 22);
                var dy = seg.y - H / 2 - (item.y + 22);
                if (dx * dx + dy * dy < PICKUP_R2) {
                    grabs[from][index] = 99;
                }
            });
        });
    });

    /* widest-path search: the worst timing window on the
       best route to each standing stretch */
    var width = segments.map(function () { return 0; });
    width[start] = 99;

    var changed = true;

    while (changed) {
        changed = false;
        segments.forEach(function (seg, from) {
            if (!width[from]) {
                return;
            }
            Object.keys(edges[from]).forEach(function (to) {
                var w = Math.min(width[from], edges[from][to]);
                if (w > width[to]) {
                    width[to] = w;
                    changed = true;
                }
            });
        });
    }

    var problems = [];
    var notes = [];

    world.pickups.forEach(function (item, index) {

        var best = 0;

        segments.forEach(function (seg, from) {
            if (grabs[from][index]) {
                best = Math.max(best, Math.min(width[from], grabs[from][index]));
            }
        });

        var label = item.type + " at (" + item.x + "," + item.y + ")";

        if (best < MIN_WINDOW) {
            problems.push(label + (best ? " needs a " + best + "-frame timing" : " unreachable"));
        } else {
            notes.push(label + " " + (best >= 99 ? "walk" : best + "f"));
        }
    });

    /* the door opens when Hacko passes terminalX - 80 */
    var door = 0;

    segments.forEach(function (seg, index) {
        if (seg.xs[seg.xs.length - 1] > level.terminalX - 80) {
            door = Math.max(door, width[index]);
        }
    });

    if (door < MIN_WINDOW) {
        problems.push("vault door " + (door ? "needs a " + door + "-frame timing" : "unreachable"));
    } else {
        notes.push("door " + (door >= 99 ? "walk" : door + "f"));
    }

    return problems.length ? problems : notes;
}


var game = loadGame();

game.LEVELS.forEach(function (level) {

    var result = checkLevel(game, level);
    var bad = result.some(function (line) {
        return /unreachable|timing|nothing/.test(line);
    });

    if (bad) {
        failed += 1;
        console.log("FAIL  level " + level.id + (level.danger ? " (live floor)" : ""));
        result.forEach(function (line) { console.log("        " + line); });
    } else {
        passed += 1;
        console.log("ok    level " + level.id + (level.danger ? " (live floor)" : "") +
            "  -  " + result.join(", "));
    }
});

console.log("\n" + passed + " passed, " + failed + " failed");

process.exit(failed ? 1 : 0);
