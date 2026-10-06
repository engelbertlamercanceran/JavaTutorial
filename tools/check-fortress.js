/* =========================================================
   HACKO - tools/check-fortress.js

   Every Function Fortress level has its own layout and its
   own mechanic. This proves each one is fair and that the
   mechanic matters:

     - every hop on the level's route is inside Hacko's jump
       (worked out from the game's own gravity, jump speed and
       run speed), with moving platforms checked at both ends
       of their run and the jump pad checked for its launch
     - the CODE button, the door and Hacko's start all stand
       on solid ground
     - on stages whose mechanic builds the way out, the door
       ledge can NOT be reached before the program runs

   It runs the stage data straight out of functionfortress.html.

       node tools/check-fortress.js
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var GAME = path.join(__dirname, "..", "functionfortress.html");

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
var from = source.indexOf("const GROUND = 485;");
var to = source.indexOf("/* end of stage data");

var game = vm.runInNewContext(
    "let level = 0;\n" + source.slice(from, to) +
    "\n;({ STAGES: STAGES, GROUND: GROUND })",
    {}
);

/* the game's physics - see update() */
function grab(pattern, label) {
    var match = source.match(pattern);
    if (!match) { throw new Error("could not read " + label); }
    return Number(match[1]);
}

var GRAVITY = grab(/player\.vy \+=\s*(\d+) \* deltaTime/, "gravity");
var JUMP = grab(/player\.vy = -(\d+);\s*player\.onGround = false;\s*HackoAudio\.play\("jump"\);\s*keys/, "jump");
var PAD = grab(/player\.vy = -(\d+);\s*player\.onGround = false;\s*state\.mech\.padFlash/, "jump pad");
var RUN = grab(/const speed = (\d+);/, "run speed");
var PLAYER_W = 38;
var PLAYER_H = 50;

/* a little short of the true limit, so no hop needs a perfect jump */
var MARGIN = 0.9;

function maxRise(speed) {
    return (speed * speed) / (2 * GRAVITY) * MARGIN;
}

/* how far Hacko travels sideways while rising `rise` px and
   coming back down onto the far ledge */
function reach(rise, speed) {
    var disc = speed * speed - 2 * GRAVITY * rise;
    if (disc < 0) { return -1; }
    var time = (speed + Math.sqrt(disc)) / GRAVITY;
    return RUN * time * MARGIN;
}

function surface(stage, step) {
    var index = typeof step === "number" ? step : Number(String(step).split("@")[0]);
    var where = typeof step === "string" ? step.split("@")[1] : null;
    var platform = stage.platforms[index];

    if (!platform) { return null; }

    var x = platform.x;
    var y = platform.y;

    if (where === "to" && platform.path) {
        x = platform.path.to.x;
        y = platform.path.to.y;
    }

    return { x: x, y: y, w: platform.w, name: index + (where ? "@" + where : "") };
}

function gap(a, b) {
    return Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
}

function hopOk(a, b, speed) {
    var rise = a.y - b.y;
    if (rise > maxRise(speed)) { return false; }
    return gap(a, b) <= reach(Math.max(rise, 0), speed);
}

function standsOn(stage, x, w, top) {
    return stage.platforms.some(function (p) {
        return p.solid !== false &&
            Math.abs(p.y - top) < 1 &&
            x + w > p.x && x < p.x + p.w;
    });
}

/* stages where the mechanic itself builds the way to the door */
var BUILDS_THE_WAY = ["torches", "bridge", "mover", "meter", "elevator", "crystals"];

ok("ten stages", game.STAGES.length === 10, game.STAGES.length + " stages");

var mechanics = {};

game.STAGES.forEach(function (stage, i) {
    var name = "level " + (i + 1) + " (" + stage.mechanic + ")";

    ok(name + " has its own mechanic", !mechanics[stage.mechanic],
        "same as level " + mechanics[stage.mechanic]);
    mechanics[stage.mechanic] = i + 1;

    /* the route */
    var speed = JUMP;
    stage.route.forEach(function (step, n) {
        if (n === 0) { return; }
        if (step === "launch") { speed = PAD; return; }

        var prev = stage.route[n - 1] === "launch" ? stage.route[n - 2] : stage.route[n - 1];

        /* "4@to" after "4@from" is Hacko riding platform 4, not a jump */
        if (String(prev).split("@")[0] === String(step).split("@")[0]) { return; }
        var a = surface(stage, prev);
        var b = surface(stage, step);

        ok(name + " hop " + (a && a.name) + " -> " + (b && b.name),
            a && b && hopOk(a, b, speed),
            a && b ? "rise " + (a.y - b.y) + ", gap " + gap(a, b) +
                " (max rise " + Math.round(maxRise(speed)) + ", reach " +
                Math.round(reach(Math.max(a.y - b.y, 0), speed)) + ")" : "missing");

        speed = JUMP;
    });

    /* start, button and door stand on something */
    var spawnFloor = stage.platforms.some(function (p) {
        return p.solid !== false && stage.spawn.x + PLAYER_W > p.x &&
            stage.spawn.x < p.x + p.w && p.y >= stage.spawn.y + PLAYER_H;
    });
    ok(name + " start is above solid ground", spawnFloor);

    /* a ground sentry must never walk into Hacko's start - it
       would hit Hacko before the player has even moved */
    stage.enemies.forEach(function (enemy, n) {
        if (enemy.fly) { return; }
        var clear = enemy.min > stage.spawn.x + PLAYER_W + 40 ||
            enemy.max + 34 < stage.spawn.x - 40;
        ok(name + " sentry " + (n + 1) + " patrols clear of the start", clear,
            "patrol " + enemy.min + "-" + (enemy.max + 34) + ", start " + stage.spawn.x);
    });

    var button = stage.button;
    var buttonBase = button.ride !== undefined
        ? stage.platforms[button.ride].x + button.dx === button.x
        : standsOn(stage, button.x, button.w, button.top);
    ok(name + " CODE button sits on a platform", buttonBase);

    var doorFloor = stage.platforms.some(function (p) {
        return Math.abs(p.y - (stage.door.y + 155)) < 1 &&
            stage.door.x + 44 > p.x && stage.door.x < p.x + p.w;
    });
    ok(name + " door stands on a floor", doorFloor);

    /* the door ledge must need the mechanic */
    if (BUILDS_THE_WAY.indexOf(stage.mechanic) !== -1) {
        var start = stage.platforms.filter(function (p) {
            return p.solid !== false && p.kind !== "pillar" && p.kind !== "car" &&
                p.kind !== "mover";
        }).map(function (p) {
            return { x: p.x, y: p.y, w: p.w, kind: p.kind };
        });
        /* moving platforms sit where they start */
        stage.platforms.forEach(function (p) {
            if (p.kind === "mover" || p.kind === "car") {
                start.push({ x: p.x, y: p.y, w: p.w, kind: p.kind });
            }
        });

        var doorTop = stage.door.y + 155;
        var reached = [start.find(function (p) {
            return stage.spawn.x >= p.x - PLAYER_W && stage.spawn.x <= p.x + p.w &&
                p.y >= stage.spawn.y;
        })];
        var changed = true;

        while (changed) {
            changed = false;
            start.forEach(function (p) {
                if (reached.indexOf(p) !== -1) { return; }
                if (reached.some(function (r) { return hopOk(r, p, JUMP); })) {
                    reached.push(p);
                    changed = true;
                }
            });
        }

        var cheat = reached.some(function (p) {
            return Math.abs(p.y - doorTop) < 1 &&
                stage.door.x + 44 > p.x && stage.door.x < p.x + p.w;
        });
        ok(name + " door can't be reached before the program runs", !cheat);
    }
});

console.log(passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
