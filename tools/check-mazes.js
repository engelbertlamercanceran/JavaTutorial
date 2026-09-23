/* =========================================================
   HACKO - tools/check-mazes.js

   Proves every Loop Labyrinth maze is actually solvable.

   This is the check that caught the bug the client reported
   as a "choke area": levels 7 and 10 had the exit walled off
   from the start, so no amount of skill could finish them.
   It also found level 8, which nobody had reported - a row
   written 23 characters wide, where cleanMap()'s slice was
   silently deleting a walkable floor tile off the end.

   Run it after ANY maze edit:

       node tools/check-mazes.js

   Exits non-zero if a maze is unsolvable or malformed.
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");

var GAME = path.join(__dirname, "..", "looplabyrinth.html");

var COLS = 21;
var ROWS = 13;

var WALL = "#";
var START = "S";
var EXIT = "E";
var GATE = "G";
var CORE = "C";


/* Pull the rawLevels array out of the page source. */
function extractLevels(source) {

    var marker = "const rawLevels";
    var start = source.indexOf(marker);

    if (start === -1) {
        throw new Error("could not find rawLevels in " + GAME);
    }

    var open = source.indexOf("[", start);
    var depth = 0;
    var end = -1;

    for (var i = open; i < source.length; i++) {
        if (source[i] === "[") {
            depth += 1;
        } else if (source[i] === "]") {
            depth -= 1;
            if (depth === 0) {
                end = i;
                break;
            }
        }
    }

    if (end === -1) {
        throw new Error("rawLevels array is not closed");
    }

    var body = source.slice(open, end + 1);
    var levels = [];
    var levelRe = /\[([\s\S]*?)\]/g;
    var match;

    while ((match = levelRe.exec(body)) !== null) {

        var rows = [];
        var rowRe = /["'`]([^"'`]*)["'`]/g;
        var row;

        while ((row = rowRe.exec(match[1])) !== null) {
            rows.push(row[1]);
        }

        if (rows.length) {
            levels.push(rows);
        }
    }

    return levels;
}


/* Mirrors cleanMap() in the game. */
function cleanMap(rows) {
    return rows.map(function (row) {
        return (row + "#####################").slice(0, COLS);
    });
}


function findAll(grid, ch) {

    var found = [];

    grid.forEach(function (row, y) {
        for (var x = 0; x < row.length; x++) {
            if (row[x] === ch) {
                found.push({ x: x, y: y });
            }
        }
    });

    return found;
}


/* Flood fill from the start over every non-wall tile. */
function reachable(grid, from) {

    var seen = {};
    var queue = [from];
    seen[from.x + "," + from.y] = true;

    var moves = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (queue.length) {

        var cur = queue.shift();

        for (var i = 0; i < moves.length; i++) {

            var nx = cur.x + moves[i][0];
            var ny = cur.y + moves[i][1];
            var key = nx + "," + ny;

            if (nx < 0 || ny < 0 || ny >= grid.length) {
                continue;
            }

            if (nx >= grid[ny].length || seen[key]) {
                continue;
            }

            if (grid[ny][nx] === WALL) {
                continue;
            }

            seen[key] = true;
            queue.push({ x: nx, y: ny });
        }
    }

    return seen;
}


function checkLevel(rows, index) {

    var label = "Level " + (index + 1);
    var problems = [];

    /* Rows wider than COLS get sliced by cleanMap(). Losing
       a trailing wall is harmless padding; losing anything
       else means playable map was deleted silently. */
    var warnings = [];

    rows.forEach(function (row, y) {

        if (row.length <= COLS) {
            return;
        }

        var dropped = row.slice(COLS);

        if (/[^#]/.test(dropped)) {
            problems.push(
                "row " + y + " is " + row.length + "ch and cleanMap() " +
                "silently deletes " + JSON.stringify(dropped) +
                " - playable tiles are being lost"
            );
        } else if (row.length > COLS + 1) {
            warnings.push(
                "row " + y + " is " + row.length + "ch (expected " +
                COLS + "); the extra is only wall, but the row is " +
                "likely a typo"
            );
        }
    });

    if (rows.length !== ROWS) {
        problems.push("has " + rows.length + " rows, expected " + ROWS);
    }

    var grid = cleanMap(rows);
    var starts = findAll(grid, START);

    if (starts.length !== 1) {
        problems.push("has " + starts.length + " start tiles, expected 1");
        return { label: label, problems: problems, warnings: warnings };
    }

    var seen = reachable(grid, starts[0]);

    function unreachable(ch, name) {

        var targets = findAll(grid, ch);
        var missed = targets.filter(function (t) {
            return !seen[t.x + "," + t.y];
        });

        if (targets.length && missed.length) {
            problems.push(
                missed.length + "/" + targets.length + " " + name +
                " unreachable from the start"
            );
        }
    }

    unreachable(EXIT, "exit");
    unreachable(GATE, "gate");
    unreachable(CORE, "core");

    return { label: label, problems: problems, warnings: warnings };
}


function main() {

    var source = fs.readFileSync(GAME, "utf8");
    var levels = extractLevels(source);

    console.log("Checking " + levels.length + " Loop Labyrinth mazes\n");

    var failed = 0;

    levels.forEach(function (rows, index) {

        var result = checkLevel(rows, index);

        if (result.problems.length) {
            failed += 1;
            console.log("  BROKEN  " + result.label);
            result.problems.forEach(function (p) {
                console.log("          - " + p);
            });
        } else if (result.warnings.length) {
            console.log("  ok      " + result.label);
            result.warnings.forEach(function (w) {
                console.log("          ! " + w);
            });
        } else {
            console.log("  ok      " + result.label);
        }
    });

    console.log(
        "\n" + (levels.length - failed) + "/" + levels.length + " solvable"
    );

    if (failed) {
        console.log("\n" + failed + " maze(s) cannot be completed.");
        process.exit(1);
    }
}

main();
