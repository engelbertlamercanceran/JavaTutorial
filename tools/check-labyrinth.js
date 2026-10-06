/* =========================================================
   HACKO - tools/check-labyrinth.js

   Conditional Labyrinth II builds a different maze for every
   level. This proves each one is fair: from the start, every
   gate can be reached without walking through another gate,
   no part of the maze is sealed off, the spare hearts can be
   reached, the sentries have a corridor to patrol away from
   the start - and no two levels share a layout.

   It runs the maze code straight out of conditionallabyrinth.html.

       node tools/check-labyrinth.js
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var GAME = path.join(__dirname, "..", "conditionallabyrinth.html");

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
var from = source.indexOf("var MISSION = 9;");
var to = source.indexOf("/* end of level data");

var stub = {
    document: {
        getElementById: function () {
            return { getContext: function () { return {}; } };
        }
    },
    Math: Math
};

var game = vm.runInNewContext(
    source.slice(from, to) +
    "\n;({ LEVELS: LEVELS, COLS: COLS, ROWS: ROWS, START: START," +
    " SENTRIES: SENTRIES, HEARTS: HEARTS, buildMaze: buildMaze," +
    " buildSentries: buildSentries, buildHearts: buildHearts," +
    " gatePositions: gatePositions, floorTiles: floorTiles })",
    stub
);


function reachable(walls) {

    var seen = {};
    var queue = [game.START];

    seen[game.START.x + "," + game.START.y] = true;

    while (queue.length) {

        var at = queue.shift();

        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {

            var x = at.x + d[0];
            var y = at.y + d[1];
            var key = x + "," + y;

            /* row 2 is the gate row - stepping in picks a gate,
               so it is never walked through */
            if (seen[key] || walls[key] || y <= 2 ||
                x < 0 || y < 0 || x >= game.COLS || y >= game.ROWS) {
                return;
            }

            seen[key] = true;
            queue.push({ x: x, y: y });
        });
    }

    return seen;
}


var layouts = {};

game.LEVELS.forEach(function (level, index) {

    var n = "level " + (index + 1);
    var walls = game.buildMaze(index);
    var seen = reachable(walls);

    ok(n + " start is open", !walls[game.START.x + "," + game.START.y]);

    ok(n + " answer is one of the gates",
        level.gates.indexOf(level.answer) !== -1);

    game.gatePositions(level.gates.length).forEach(function (gate, g) {

        var entry = [gate.x - 1, gate.x, gate.x + 1].some(function (x) {
            return !walls[x + ",2"] && seen[x + ",3"];
        });

        ok(n + " gate " + level.gates[g] + " can be reached", entry);
    });

    var tiles = game.floorTiles(walls);
    var sealed = tiles.filter(function (t) { return !seen[t.x + "," + t.y]; });

    ok(n + " has no sealed-off corridors", sealed.length === 0,
        sealed.length + " tiles unreachable");

    var inside = (game.COLS - 2) * (game.ROWS - 4);

    ok(n + " looks like a labyrinth (walls fill the maze)",
        tiles.length < inside * 0.75,
        tiles.length + " of " + inside + " tiles open");

    var sentries = game.buildSentries(index, walls);

    ok(n + " has its " + game.SENTRIES[index] + " sentries",
        sentries.length === game.SENTRIES[index]);

    sentries.forEach(function (sentry) {
        ok(n + " sentry patrols a real corridor",
            sentry.path.length >= 4 && sentry.path.every(function (p) {
                return !walls[p.x + "," + p.y] && seen[p.x + "," + p.y];
            }));
    });

    var hearts = game.buildHearts(index, walls);

    ok(n + " has its " + game.HEARTS[index] + " hearts",
        hearts.length === game.HEARTS[index]);

    hearts.forEach(function (heart) {
        ok(n + " heart can be reached", seen[heart.x + "," + heart.y]);
    });

    var signature = Object.keys(walls).sort().join(";");

    ok(n + " has its own layout", !layouts[signature],
        "same as level " + layouts[signature]);

    layouts[signature] = index + 1;

    ok(n + " is the same maze every time",
        Object.keys(game.buildMaze(index)).sort().join(";") === signature);
});

console.log(passed + " passed, " + failed + " failed");

process.exit(failed ? 1 : 0);
