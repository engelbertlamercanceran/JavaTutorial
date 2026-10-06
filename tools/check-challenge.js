/* =========================================================
   HACKO - tools/check-challenge.js

   Conditional Challenge has its own maze on every level. This
   proves each one is fair: the grid is the right size and
   walled in, every corridor joins up, every clue and the bomb
   can be reached from the start, the level has as many clues
   and birds as its lesson needs, and no bird nests within six
   steps of where Hacko starts. No two levels share a layout.

   It runs the maze code straight out of conditionalchallenge.html.

       node tools/check-challenge.js
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var GAME = path.join(__dirname, "..", "conditionalchallenge.html");

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

function slice(from, to) {
    var a = source.indexOf(from);
    var b = source.indexOf(to, a);
    if (a < 0 || b < 0) {
        throw new Error("marker not found: " + from + " / " + to);
    }
    return source.slice(a, b);
}

var game = vm.runInNewContext(
    slice("const TILE_SIZE", "/* end of maze data") +
    slice("const LEVELS", "const playerImage") +
    "\n;({ COLS: COLS, ROWS: ROWS, TILE: TILE, MAZES: MAZES," +
    " LEVELS: LEVELS, parseMaze: parseMaze })",
    {}
);

var MIN_BIRD_DISTANCE = 6;

function key(p) {
    return p.x + "," + p.y;
}

function distances(grid, start) {
    var dist = {};
    var queue = [start];
    dist[key(start)] = 0;

    while (queue.length) {
        var at = queue.shift();

        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            var next = { x: at.x + d[0], y: at.y + d[1] };
            var row = grid[next.y];

            if (!row || row[next.x] !== game.TILE.PATH) { return; }
            if (dist[key(next)] !== undefined) { return; }

            dist[key(next)] = dist[key(at)] + 1;
            queue.push(next);
        });
    }

    return dist;
}


ok("one maze per level", game.MAZES.length === game.LEVELS.length,
    game.MAZES.length + " mazes for " + game.LEVELS.length + " levels");

var layouts = {};

game.LEVELS.forEach(function (level, index) {
    var name = "level " + level.id;
    var raw = game.MAZES[index];
    var maze = game.parseMaze(index);
    var grid = maze.grid;

    ok(name + " has " + game.ROWS + " rows", raw.rows.length === game.ROWS,
        raw.rows.length + " rows");

    raw.rows.forEach(function (row, y) {
        ok(name + " row " + y + " is " + game.COLS + " wide",
            row.length === game.COLS, row.length + ": " + row);
        ok(name + " row " + y + " uses known symbols",
            /^[#.SBPa-e1-5]+$/.test(row), row);
    });

    var walled = true;
    for (var x = 0; x < game.COLS; x++) {
        if (grid[0][x] !== game.TILE.WALL ||
            grid[game.ROWS - 1][x] !== game.TILE.WALL) { walled = false; }
    }
    for (var y = 0; y < game.ROWS; y++) {
        if (grid[y][0] !== game.TILE.WALL ||
            grid[y][game.COLS - 1] !== game.TILE.WALL) { walled = false; }
    }
    ok(name + " is walled in", walled);

    ok(name + " has a start", !!maze.start);
    ok(name + " has a bomb", !!maze.bomb);
    if (!maze.start || !maze.bomb) { return; }

    var placed = maze.clues.filter(Boolean).length;
    ok(name + " has one clue spot per clue",
        placed === level.clues.length && maze.clues.length === level.clues.length,
        placed + " spots for " + level.clues.length + " clues");

    var birds = maze.birds.filter(Boolean).length;
    ok(name + " has a nest for every bird",
        birds >= level.ghosts && maze.birds.length === birds,
        birds + " nests for " + level.ghosts + " birds");

    ok(name + " has power cores", maze.powers.length >= 2,
        maze.powers.length + " cores");

    var dist = distances(grid, maze.start);
    var open = 0;
    grid.forEach(function (row) {
        row.forEach(function (cell) {
            if (cell === game.TILE.PATH) { open += 1; }
        });
    });

    ok(name + " has no sealed corridors", Object.keys(dist).length === open,
        (open - Object.keys(dist).length) + " tiles cut off");

    ok(name + " bomb is reachable", dist[key(maze.bomb)] !== undefined);

    maze.clues.forEach(function (clue, i) {
        ok(name + " clue " + (i + 1) + " is reachable",
            clue && dist[key(clue)] !== undefined, clue && key(clue));
    });

    maze.powers.forEach(function (power) {
        ok(name + " power core " + key(power) + " is reachable",
            dist[key(power)] !== undefined);
    });

    maze.birds.slice(0, level.ghosts).forEach(function (bird, i) {
        var d = dist[key(bird)];
        ok(name + " bird " + (i + 1) + " nests away from the start",
            d !== undefined && d >= MIN_BIRD_DISTANCE,
            "only " + d + " steps away");
    });

    var shape = grid.map(function (row) { return row.join(""); }).join("/");
    ok(name + " layout is its own", !layouts[shape],
        "same as level " + layouts[shape]);
    layouts[shape] = level.id;
});

console.log(passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
