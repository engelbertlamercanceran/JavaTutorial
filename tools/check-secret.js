/* =========================================================
   HACKO - tools/check-secret.js

   The Secret Message drops Hacko in at a different spawn on
   every level. This proves each spawn is fair: it is a floor
   tile, it is not on a clue, a checkpoint or a guard's patrol
   line, Hacko has room to step away from it before meeting a
   guard, and every clue, the door and the exit can be reached
   from it. No two levels share a spawn.

   It runs the level data straight out of thesecretmessage.html.

       node tools/check-secret.js
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var GAME = path.join(__dirname, "..", "thesecretmessage.html");

var passed = 0;
var failed = 0;

function ok(name, condition, detail) {
    if (condition) {
        passed += 1;
    } else {
        failed += 1;
        console.log("FAIL  " + name + (detail ? "  -  " + detail : ""));
    }
}


var source = fs.readFileSync(GAME, "utf8");
var from = source.indexOf("const MAP_WIDTH");
var to = source.indexOf("const playerImage");

var game = vm.runInNewContext(
    source.slice(from, to) +
    "\n;({ W: MAP_WIDTH, H: MAP_HEIGHT, TILE: TILE, MAP: BASE_MAP," +
    " LEVELS: LEVELS, SPAWNS: SPAWNS, CLUES: CLUE_POSITIONS," +
    " ENEMIES: ENEMY_TEMPLATES, CHECKPOINTS: CHECKPOINT_POSITIONS," +
    " DOOR: DOOR_POSITION, EXIT: EXIT_POSITION })",
    {}
);

function key(x, y) {
    return x + "," + y;
}

function tile(x, y) {
    if (x < 0 || y < 0 || x >= game.W || y >= game.H) {
        return game.TILE.WALL;
    }
    return game.MAP[y][x];
}

/* every tile a guard can stand on while patrolling */
function patrolTiles(level) {
    var tiles = {};

    game.ENEMIES.slice(0, level.enemyCount).forEach(function (enemy) {
        if (enemy.axis === "x") {
            for (var x = enemy.minX; x <= enemy.maxX; x++) {
                if (tile(x, enemy.y) === game.TILE.FLOOR) {
                    tiles[key(x, enemy.y)] = true;
                }
            }
        } else {
            for (var y = enemy.minY; y <= enemy.maxY; y++) {
                if (tile(enemy.x, y) === game.TILE.FLOOR) {
                    tiles[key(enemy.x, y)] = true;
                }
            }
        }
    });

    return tiles;
}

/* flood fill from the spawn; the door only opens once unlocked */
function reach(start, doorOpen, avoid) {
    var seen = {};
    var queue = [start];
    seen[key(start.x, start.y)] = true;

    while (queue.length) {
        var at = queue.shift();

        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            var x = at.x + d[0];
            var y = at.y + d[1];
            var t = tile(x, y);

            if (t === game.TILE.WALL || seen[key(x, y)]) { return; }
            if (t === game.TILE.DOOR && !doorOpen) { return; }
            if (avoid && avoid[key(x, y)]) { return; }

            seen[key(x, y)] = true;
            queue.push({ x: x, y: y });
        });
    }

    return seen;
}


ok("one spawn per level", game.SPAWNS.length === game.LEVELS.length,
    game.SPAWNS.length + " spawns for " + game.LEVELS.length + " levels");

var used = {};

game.LEVELS.forEach(function (level, index) {
    var name = "level " + level.id;
    var spawn = game.SPAWNS[index];
    var at = key(spawn.x, spawn.y);
    var patrol = patrolTiles(level);

    var clues = level.requiredClues.map(function (id, i) {
        return game.CLUES[i];
    });
    var checkpoints = game.CHECKPOINTS.slice(0, level.checkpoints);

    ok(name + " spawn is a floor tile",
        tile(spawn.x, spawn.y) === game.TILE.FLOOR, at);
    ok(name + " spawn is not on a clue",
        !clues.some(function (c) { return key(c.x, c.y) === at; }), at);
    ok(name + " spawn is not on a checkpoint",
        !checkpoints.some(function (c) { return key(c.x, c.y) === at; }), at);
    ok(name + " spawn is off every patrol line", !patrol[at], at);
    ok(name + " spawn has a name and a note", !!(spawn.name && spawn.note));

    ok(name + " spawn differs from every other level", !used[at],
        "shared with level " + used[at]);
    used[at] = level.id;

    /* Somewhere to stand while reading the room: at least four
       tiles reachable without crossing a patrol line. */
    var pocket = Object.keys(reach(spawn, false, patrol)).length;
    ok(name + " spawn has room before the first guard", pocket >= 4,
        pocket + " safe tiles");

    var locked = reach(spawn, false);
    clues.forEach(function (c, i) {
        ok(name + " clue " + (i + 1) + " is reachable",
            !!locked[key(c.x, c.y)], key(c.x, c.y));
    });

    var doorSide = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) {
        return locked[key(game.DOOR.x + d[0], game.DOOR.y + d[1])];
    });
    ok(name + " the door terminal is reachable", doorSide);

    var open = reach(spawn, true);
    ok(name + " the exit is reachable once the door opens",
        !!open[key(game.EXIT.x, game.EXIT.y)]);
});

console.log(passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
