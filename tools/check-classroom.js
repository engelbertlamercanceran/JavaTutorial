/* =========================================================
   HACKO - tools/check-classroom.js

   Classroom Rescue's desks, chairs and furniture are solid,
   so a layout change can wall something off. This walks the
   room the way the game does - 4px steps, one axis at a time,
   colliding by Hacko's feet - and checks that from the start
   spot Hacko can get close enough to talk to every character,
   use the computer, pick up every item and walk out the door.

   It reads ROOM straight out of classroomrescue.html.

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
var to = source.indexOf("function renderRoom");

var room = vm.runInNewContext(
    source.slice(from, to) + "\n;({ ROOM, FEET, SOLIDS })",
    {}
);

var ROOM = room.ROOM;
var FEET = room.FEET;
var SOLIDS = room.SOLIDS;


function blocked(x, y) {
    var fx = x + FEET.x;
    var fy = y + FEET.y;
    return SOLIDS.some(function (r) {
        return fx < r.x + r.w && fx + FEET.w > r.x &&
            fy < r.y + r.h && fy + FEET.h > r.y;
    });
}

function clampX(x) { return Math.max(0, Math.min(ROOM_W - PLAYER.w, x)); }
function clampY(y) { return Math.max(TOP, Math.min(ROOM_H - PLAYER.h, y)); }


/* every spot Hacko can walk to, moving like movePlayer() */
ok("start spot is clear of furniture",
    !blocked(ROOM.start.x, ROOM.start.y));

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


function closest(target) {

    var cx = target.x + target.w / 2;
    var cy = target.y + target.h / 2;
    var best = Infinity;

    spots.forEach(function (s) {
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


Object.keys(SIZES).forEach(function (name) {

    var spot = ROOM.spots[name];
    var near = closest({
        x: spot.x, y: spot.y, w: SIZES[name].w, h: SIZES[name].h
    });

    ok(name + " can be reached", near < TALK,
        "closest Hacko gets is " + Math.round(near) + "px, needs < " + TALK);
});

var door = closest(DOOR);

ok("exit door can be walked through", door < EXIT,
    "closest Hacko gets is " + Math.round(door) + "px, needs < " + EXIT);

/* the desks are meant to be in the way: there must be no
   straight run across the middle of the room */
var rowY = 196 + 22 - FEET.y - FEET.h / 2;

ok("desk rows actually block a straight walk across",
    blocked(300 + 20, Math.round(rowY)));

console.log(
    "Classroom: " + spots.length + " walkable spots\n" +
    passed + " passed, " + failed + " failed"
);

process.exit(failed ? 1 : 0);
