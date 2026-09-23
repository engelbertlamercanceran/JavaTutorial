/* =========================================================
   HACKO - tools/check-jumps.js

   Checks that every Escape Room pickup can actually be
   reached, and how much margin the player has.

   Level 3 shipped with its "double" pickup needing 276px of
   rise against a theoretical maximum of 312px - 88% of a
   perfect double jump, fired exactly at the apex, landing in
   a 36px window. Technically possible, effectively not.

   Levels 4-10 are generated and put each pickup directly
   above a platform, which is the shape to aim for.

       node tools/check-jumps.js
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");

var GAME = path.join(__dirname, "..", "theescaperoom.html");

/* physics, read from the game */
var GRAVITY = 0.92;
var JUMP_V = 16.5;
var PLAYER_H = 64;
var PLAYER_W = 64;
var PICKUP_R = Math.sqrt(1300);   /* centre-to-centre */
var GROUND_Y = 440;

/* How hard a jump may be before it stops being fun. A pickup
   needing more than this share of a perfect double jump is
   flagged. */
var COMFORTABLE = 0.70;

var passed = 0;
var failed = 0;
var warned = 0;


function rise(velocity) {
    var total = 0;
    var vy = -velocity;
    while (vy < 0) {
        total += -vy;
        vy += GRAVITY;
    }
    return total;
}

var SINGLE = rise(JUMP_V);
var DOUBLE = SINGLE + rise(JUMP_V);   /* second jump at the apex */


function levelsFrom(source) {

    var from = source.indexOf("const LEVELS");
    var open = source.indexOf("[", from);
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

    var body = source.slice(open, end + 1);
    var out = [];
    depth = 0;
    var start = null;

    for (var k = 0; k < body.length; k++) {
        if (body[k] === "{") {
            if (depth === 0) {
                start = k;
            }
            depth += 1;
        } else if (body[k] === "}") {
            depth -= 1;
            if (depth === 0) {
                out.push(body.slice(start, k + 1));
            }
        }
    }

    return out;
}


function parseList(block, key, pattern) {

    var at = block.indexOf(key + ":");

    if (at === -1) {
        return [];
    }

    var open = block.indexOf("[", at);
    var depth = 0;
    var end = -1;

    for (var i = open; i < block.length; i++) {
        if (block[i] === "[") {
            depth += 1;
        } else if (block[i] === "]") {
            depth -= 1;
            if (depth === 0) {
                end = i;
                break;
            }
        }
    }

    var body = block.slice(open, end + 1);
    var out = [];
    var match;

    while ((match = pattern.exec(body)) !== null) {
        out.push(match);
    }

    pattern.lastIndex = 0;

    return out;
}


var source = fs.readFileSync(GAME, "utf8");
var blocks = levelsFrom(source);

console.log("jump reach: single " + SINGLE.toFixed(0) +
    "px, double " + DOUBLE.toFixed(0) + "px, pickup radius " +
    PICKUP_R.toFixed(0) + "px\n");

blocks.forEach(function (block, index) {

    var id = (block.match(/id:\s*(\d+)/) || [])[1] || (index + 1);

    var platforms = parseList(
        block, "platforms",
        /\{\s*x:\s*(-?\d+),\s*y:\s*(-?\d+),\s*w:\s*(-?\d+)/g
    ).map(function (m) {
        return { x: +m[1], y: +m[2], w: +m[3] };
    });

    var pickups = parseList(
        block, "collectibles",
        /createCollectible\(\s*(-?\d+),\s*(-?\d+),\s*'(\w+)'/g
    ).map(function (m) {
        return { x: +m[1], y: +m[2], type: m[3] };
    });

    if (!pickups.length) {
        return;
    }

    console.log("Level " + id);

    pickups.forEach(function (pickup) {

        /* the highest platform the player could launch from,
           allowing a small horizontal run-up */
        var stand = GROUND_Y;

        platforms.forEach(function (p) {
            if (pickup.x >= p.x - PLAYER_W - 26 &&
                pickup.x <= p.x + p.w + PLAYER_W + 26) {
                if (p.y < stand) {
                    stand = p.y;
                }
            }
        });

        var centreFrom = stand - PLAYER_H / 2;
        var target = pickup.y + 22;
        var need = centreFrom - target - PICKUP_R;
        var share = need / DOUBLE;

        var verdict;

        if (need > DOUBLE) {
            failed += 1;
            verdict = "UNREACHABLE";
        } else if (share > COMFORTABLE) {
            warned += 1;
            verdict = "NEAR-IMPOSSIBLE (" +
                Math.round(share * 100) + "% of a perfect double jump)";
        } else {
            passed += 1;
            verdict = "ok (" + Math.round(Math.max(share, 0) * 100) + "%)";
        }

        console.log(
            "  " + pickup.type.padEnd(8) +
            " x=" + String(pickup.x).padStart(5) +
            " y=" + String(pickup.y).padStart(4) +
            "  launch from y=" + String(stand).padStart(4) +
            "  needs " + String(Math.round(Math.max(need, 0))).padStart(3) +
            "px   " + verdict
        );
    });
});

console.log(
    "\n" + passed + " comfortable, " + warned + " near-impossible, " +
    failed + " unreachable"
);

if (failed || warned) {
    process.exit(1);
}
