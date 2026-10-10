/* =========================================================
   HACKO - tools/check-arrays.js

   Array Adventure has its own map on every mission. This
   proves each one is fair: the grid is the right size and
   walled in, no floor is sealed off, every item and the
   portal can be reached without stepping on data spikes, the
   mission keeps its item, trap and glitch counts, each glitch
   has room to move the way it is meant to, and none starts
   within four steps of Hacko. No two missions share a map.

   No chokes: a sweeper or climber's lane never runs more
   than MAX_NO_EXIT tiles without a side pocket to duck into,
   and no glitch patrols the only tunnel into the portal. Level 10
   shipped with both - a corridor swept end to end and a
   one-tile tunnel to the portal - and could not be crossed.
   Missions 3 and 9 had the same portal tunnel and were
   opened up too.

   It runs the map code straight out of arrayadventure.html.

       node tools/check-arrays.js
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var GAME = path.join(__dirname, "..", "arrayadventure.html");

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
var from = source.indexOf("const missions = [");
var to = source.indexOf("/* end of map data");

var game = vm.runInNewContext(
    "const COLS = 15; const ROWS = 10;\n" +
    source.slice(from, to) +
    "\n;({ missions: missions, MAPS: MAPS, parseMap: parseMap," +
    " COLS: COLS, ROWS: ROWS })",
    {}
);

/* the per-mission threat counts the game always had */
function trapCount(i) { return Math.min(1 + Math.floor(i * 0.7), 7); }
function glitchCount(i) { return Math.min(1 + Math.floor(i / 2), 5); }
var BEHAVIOURS = ["sweeper", "climber", "roamer"];
var MIN_GLITCH_DISTANCE = 4;
var MAX_NO_EXIT = 3;

function key(p) { return p.x + "," + p.y; }

function walk(map, start, avoidSpikes) {
    var spikes = {};
    map.hazards.forEach(function (h) { spikes[key(h)] = true; });

    var dist = {};
    var queue = [start];
    dist[key(start)] = 0;

    while (queue.length) {
        var at = queue.shift();

        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            var next = { x: at.x + d[0], y: at.y + d[1] };
            var k = key(next);

            if (map.walls.has(k) || dist[k] !== undefined) { return; }
            if (next.x < 0 || next.y < 0 || next.x >= game.COLS || next.y >= game.ROWS) { return; }
            if (avoidSpikes && spikes[k]) { return; }

            dist[k] = dist[key(at)] + 1;
            queue.push(next);
        });
    }

    return dist;
}


ok("one map per mission", game.MAPS.length === game.missions.length,
    game.MAPS.length + " maps for " + game.missions.length + " missions");

var seen = {};

game.missions.forEach(function (mission, i) {
    var name = "mission " + (i + 1);
    var raw = game.MAPS[i];
    var map = game.parseMap(i);

    ok(name + " has a name and colours", !!(raw.name && raw.theme && raw.theme.sky));
    ok(name + " has " + game.ROWS + " rows", raw.rows.length === game.ROWS);

    raw.rows.forEach(function (row, y) {
        ok(name + " row " + y + " is " + game.COLS + " wide",
            row.length === game.COLS, row.length + ": " + row);
        ok(name + " row " + y + " uses known symbols",
            /^[#.SX^a-f1-5]+$/.test(row), row);
        var edge = y === 0 || y === game.ROWS - 1
            ? /^#+$/.test(row)
            : row[0] === "#" && row[game.COLS - 1] === "#";
        ok(name + " row " + y + " is walled in", edge, row);
    });

    ok(name + " has a start", !!map.start);
    ok(name + " has a portal", !!map.portal);
    if (!map.start || !map.portal) { return; }

    var items = map.items.filter(Boolean).length;
    ok(name + " has a spot for every item",
        items === mission.items.length && map.items.length === items,
        items + " spots for " + mission.items.length + " items");

    ok(name + " keeps its " + trapCount(i) + " traps",
        map.hazards.length === trapCount(i), map.hazards.length + " traps");

    var glitches = map.enemies.filter(Boolean).length;
    ok(name + " keeps its " + glitchCount(i) + " glitches",
        glitches === glitchCount(i) && map.enemies.length === glitches,
        glitches + " glitches");

    var all = walk(map, map.start, false);
    var floors = 0;
    raw.rows.forEach(function (row) {
        row.split("").forEach(function (c) { if (c !== "#") { floors += 1; } });
    });
    ok(name + " has no sealed floor", Object.keys(all).length === floors,
        (floors - Object.keys(all).length) + " tiles cut off");

    var safe = walk(map, map.start, true);
    ok(name + " portal is reachable without spikes", safe[key(map.portal)] !== undefined);
    map.items.forEach(function (item, n) {
        ok(name + " item " + (n + 1) + " is reachable without spikes",
            item && safe[key(item)] !== undefined, item && key(item));
    });

    map.enemies.forEach(function (enemy, n) {
        var d = all[key(enemy)];
        ok(name + " glitch " + (n + 1) + " starts away from Hacko",
            d !== undefined && d >= MIN_GLITCH_DISTANCE, "only " + d + " steps");

        var free = function (dx, dy) {
            var k = (enemy.x + dx) + "," + (enemy.y + dy);
            return !map.walls.has(k) && k !== key(map.portal) && k !== key(map.start);
        };
        var kind = BEHAVIOURS[n % 3];
        var room = kind === "sweeper" ? free(1, 0) || free(-1, 0)
            : kind === "climber" ? free(0, 1) || free(0, -1)
            : free(1, 0) || free(-1, 0) || free(0, 1) || free(0, -1);
        ok(name + " glitch " + (n + 1) + " (" + kind + ") has room to move", room, key(enemy));

        if (kind === "roamer") { return; }

        /* the tiles it walks back and forth over */
        var axis = kind === "sweeper" ? [1, 0] : [0, 1];
        var side = kind === "sweeper" ? [0, 1] : [1, 0];
        var x = enemy.x;
        var y = enemy.y;
        while (free(x - axis[0] - enemy.x, y - axis[1] - enemy.y)) { x -= axis[0]; y -= axis[1]; }
        var lane = [];
        while (free(x - enemy.x, y - enemy.y)) { lane.push({ x: x, y: y }); x += axis[0]; y += axis[1]; }

        var spikes = {};
        map.hazards.forEach(function (h) { spikes[key(h)] = true; });
        var pocket = function (px, py) {
            var k = px + "," + py;
            return !map.walls.has(k) && !spikes[k];
        };

        var run = 0;
        var worst = 0;
        lane.forEach(function (t) {
            var exit = pocket(t.x + side[0], t.y + side[1]) || pocket(t.x - side[0], t.y - side[1]);
            run = exit ? 0 : run + 1;
            worst = Math.max(worst, run);
        });
        ok(name + " glitch " + (n + 1) + " lane has places to dodge", worst <= MAX_NO_EXIT,
            worst + " tiles in a row with no side pocket");

        /* block the part of its lane next to the portal: the
           portal must still be reachable some other way, or the
           glitch walks the only tunnel in */
        var blocked = { walls: new Set(map.walls), hazards: [] };
        lane.forEach(function (t) {
            if (Math.abs(t.x - map.portal.x) + Math.abs(t.y - map.portal.y) <= 2) {
                blocked.walls.add(key(t));
            }
        });
        var around = walk(blocked, map.start, false);
        var guarded = around[key(map.portal)] === undefined;

        ok(name + " glitch " + (n + 1) + " does not guard the only tunnel into the portal",
            !guarded, "lane " + lane.map(key).join(" ") + " blocks portal " + key(map.portal));
    });

    var shape = raw.rows.join("/").replace(/[^#\n\/]/g, ".");
    ok(name + " layout is its own", !seen[shape], "same walls as mission " + seen[shape]);
    seen[shape] = i + 1;
});

console.log(passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
