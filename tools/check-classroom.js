/* =========================================================
   HACKO - tools/check-classroom.js

   Classroom Rescue's desks, chairs and furniture are solid,
   so a layout change can wall something off. This walks the
   room the way the game does - 4px steps, one axis at a time,
   colliding by Hacko's feet - and checks that from the start
   spot Hacko can get close enough to talk to every character,
   use the computer, pick up every item and walk out the door.

   Every level has its own room (ROOMS), and from level 2 on
   lockdown bugs patrol it. So, for every room, it also checks
   that each character and item can be reached from a spot
   clear of every patrol line - the player is never forced to
   stand on one to talk or pick up - that no bug walks through
   furniture or a character, that the start spot is well away
   from them, and that no two rooms are the same.

   It reads ROOMS straight out of classroomrescue.html.

       node tools/check-classroom.js
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var GAME = path.join(__dirname, "..", "classroomrescue.html");

/* the smallest room the layout has to work in - #world on a
   1280 x 720 screen */
var ROOM_W = 760;
var ROOM_H = 490;

var PLAYER = { w: 52, h: 70 };
var STEP = 4;
var TOP = 82;

/* checkNearby() and checkExit() distances, centre to centre */
var TALK = 95;
var EXIT = 60;

/* rendered sizes of the things Hacko walks up to */
var SIZES = {
    teacher: { w: 48, h: 58 },
    alex: { w: 48, h: 58 },
    robo: { w: 48, h: 58 },
    computer: { w: 44, h: 40 },
    key: { w: 42, h: 42 },
    battery: { w: 42, h: 42 },
    book: { w: 42, h: 42 }
};

/* #door in the stylesheet */
var DOOR = { x: 18, y: 105, w: 82, h: 154 };

/* a bug's sprite (BUG_SIZE in the game), and how close a patrol
   line may come to where Hacko talks from or starts - feet
   centre to bug centre */
var BUG = 34;
var SAFE = 60;
var START_CLEAR = 90;

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
var from = source.indexOf("const DESK_COLUMNS");
var to = source.indexOf("/* end of room data");

var game = vm.runInNewContext(
    source.slice(from, to) + "\n;({ ROOMS, FEET, solidsFor })",
    {}
);

var FEET = game.FEET;

ok("one room per level", game.ROOMS.length === 10, game.ROOMS.length + " rooms");


function segDist(px, py, a, b) {
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var len = dx * dx + dy * dy;
    var t = len ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len)) : 0;
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}


function checkRoom(ROOM, index) {

    var name = "level " + (index + 1) + " (" + ROOM.name + ")";
    var SOLIDS = game.solidsFor(ROOM);
    var bugs = ROOM.bugs || [];

    function blocked(x, y) {
        var fx = x + FEET.x;
        var fy = y + FEET.y;
        return SOLIDS.some(function (r) {
            return fx < r.x + r.w && fx + FEET.w > r.x &&
                fy < r.y + r.h && fy + FEET.h > r.y;
        });
    }

    /* how close Hacko standing at x,y is to the nearest patrol line */
    function bugDist(x, y) {
        var px = x + FEET.x + FEET.w / 2;
        var py = y + FEET.y + FEET.h / 2;
        var best = Infinity;
        bugs.forEach(function (bug) {
            for (var i = 0; i + 1 < bug.path.length; i++) {
                best = Math.min(best, segDist(px, py,
                    [bug.path[i][0] + BUG / 2, bug.path[i][1] + BUG / 2],
                    [bug.path[i + 1][0] + BUG / 2, bug.path[i + 1][1] + BUG / 2]));
            }
        });
        return best;
    }

    function clampX(x) { return Math.max(0, Math.min(ROOM_W - PLAYER.w, x)); }
    function clampY(y) { return Math.max(TOP, Math.min(ROOM_H - PLAYER.h, y)); }

    ok(name + " start spot is clear of furniture",
        !blocked(ROOM.start.x, ROOM.start.y));

    ok(name + " start spot is away from the bugs",
        bugDist(ROOM.start.x, ROOM.start.y) >= START_CLEAR,
        Math.round(bugDist(ROOM.start.x, ROOM.start.y)) + "px from a patrol line");

    /* every spot Hacko can walk to, moving like movePlayer() */
    var seen = {};
    var queue = [[ROOM.start.x, ROOM.start.y]];
    var spots = [];

    seen[ROOM.start.x + "," + ROOM.start.y] = true;

    while (queue.length) {

        var at = queue.shift();
        spots.push(at);

        [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]].forEach(function (d) {

            var x = clampX(at[0] + d[0]);
            var y = clampY(at[1] + d[1]);

            if (blocked(x, at[1])) { x = at[0]; }
            if (blocked(x, y)) { y = at[1]; }

            var key = x + "," + y;

            if (!seen[key]) {
                seen[key] = true;
                queue.push([x, y]);
            }
        });
    }

    function closest(target, offPatrol) {

        var cx = target.x + target.w / 2;
        var cy = target.y + target.h / 2;
        var best = Infinity;

        spots.forEach(function (s) {
            if (offPatrol && bugDist(s[0], s[1]) < SAFE) {
                return;
            }
            var d = Math.hypot(
                s[0] + PLAYER.w / 2 - cx,
                s[1] + PLAYER.h / 2 - cy
            );
            if (d < best) {
                best = d;
            }
        });

        return best;
    }

    Object.keys(SIZES).forEach(function (thing) {

        var spot = ROOM.spots[thing];
        var box = { x: spot.x, y: spot.y, w: SIZES[thing].w, h: SIZES[thing].h };
        var near = closest(box, false);

        ok(name + " " + thing + " can be reached", near < TALK,
            "closest Hacko gets is " + Math.round(near) + "px, needs < " + TALK);

        if (bugs.length) {
            var safe = closest(box, true);
            ok(name + " " + thing + " can be reached away from the patrol lines", safe < TALK,
                "closest safe spot is " + Math.round(safe) + "px, needs < " + TALK);
        }
    });

    var door = closest(DOOR, false);

    ok(name + " exit door can be walked through", door < EXIT,
        "closest Hacko gets is " + Math.round(door) + "px, needs < " + EXIT);

    /* bugs walk on the floor, round the furniture */
    bugs.forEach(function (bug, n) {
        var crossing = null;
        for (var i = 0; i + 1 < bug.path.length && !crossing; i++) {
            for (var t = 0; t <= 1 && !crossing; t += 0.02) {
                var x = bug.path[i][0] + (bug.path[i + 1][0] - bug.path[i][0]) * t;
                var y = bug.path[i][1] + (bug.path[i + 1][1] - bug.path[i][1]) * t;
                SOLIDS.forEach(function (r) {
                    if (!crossing && x + 6 < r.x + r.w && x + BUG - 6 > r.x &&
                        y + BUG - 10 < r.y + r.h && y + BUG > r.y) {
                        crossing = (r.type || "a character") + " at " + Math.round(x) + "," + Math.round(y);
                    }
                });
            }
        }
        ok(name + " bug " + (n + 1) + " stays on the floor", !crossing, "walks through " + crossing);
    });

    if (ROOM.hunter) {
        ok(name + " hunter starts on the floor", !SOLIDS.some(function (r) {
            return ROOM.hunter.x + 8 < r.x + r.w && ROOM.hunter.x + 26 > r.x &&
                ROOM.hunter.y + 22 < r.y + r.h && ROOM.hunter.y + 34 > r.y;
        }));
        var h = Math.hypot(ROOM.hunter.x - ROOM.start.x, ROOM.hunter.y - ROOM.start.y);
        ok(name + " hunter starts across the room", h > 350, Math.round(h) + "px from the start");
    }

    return spots.length;
}


var counts = game.ROOMS.map(checkRoom);

/* level 1 is the original classroom: the desk rows are meant to
   be in the way, with no straight run across the middle */
var first = game.solidsFor(game.ROOMS[0]);
var rowY = Math.round(196 + 22 - FEET.y - FEET.h / 2);

ok("level 1 desk rows actually block a straight walk across",
    first.some(function (r) {
        var fx = 320 + FEET.x;
        var fy = rowY + FEET.y;
        return fx < r.x + r.w && fx + FEET.w > r.x && fy < r.y + r.h && fy + FEET.h > r.y;
    }));

/* no two levels share a room */
var shapes = {};

game.ROOMS.forEach(function (room, i) {
    var shape = JSON.stringify([room.pieces, room.spots]);
    ok("level " + (i + 1) + " room is its own", !shapes[shape], "same as level " + shapes[shape]);
    shapes[shape] = i + 1;
});

/* level 1 teaches the controls in peace; bugs from level 2, the
   hunter from level 6 */
game.ROOMS.forEach(function (room, i) {
    var bugs = (room.bugs || []).length;
    ok("level " + (i + 1) + (i ? " has bugs" : " has no bugs"), i ? bugs > 0 : bugs === 0);
    ok("level " + (i + 1) + (i >= 5 ? " has" : " has no") + " hunter", !!room.hunter === (i >= 5));
});

console.log(
    "Classroom: " + counts.join(" / ") + " walkable spots\n" +
    passed + " passed, " + failed + " failed"
);

process.exit(failed ? 1 : 0);
