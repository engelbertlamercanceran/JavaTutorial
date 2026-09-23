/* =========================================================
   HACKO - tools/check-items.js

   Proves every Array Adventure item is telling apart on
   screen, and that each silhouette actually draws.

   The client reported that the collectables were "all the
   same colour". They were: ITEM_COLORS held 15 entries while
   the missions use 42 items, so 27 of them fell back to one
   lime-green diamond. That made whole puzzles guesswork -
   mission 2 asks you to grab RedCrystal BEFORE BlueCrystal,
   and mission 10 asks you to sort Rune5/9/12/16.

   Run after editing ITEM_STYLES or the missions:

       node tools/check-items.js
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");

var GAME = path.join(__dirname, "..", "arrayadventure.html");

var passed = 0;
var failed = 0;

function ok(name, condition) {
    if (condition) {
        passed += 1;
    } else {
        failed += 1;
        console.log("  FAIL  " + name);
    }
}


/* Pull the rendering helpers out of the page without
   booting the whole game. */
function loadRenderer() {

    var src = fs.readFileSync(GAME, "utf8");
    var from = src.indexOf("const ITEM_STYLES");
    var to = src.indexOf("function normalizeItem", from);

    if (from === -1 || to === -1) {
        throw new Error("could not find ITEM_STYLES in " + GAME);
    }

    var body = src.slice(from, to) +
        "\nreturn { ITEM_STYLES, itemStyle, itemLabel, " +
        "drawItemShape, GLITCH_TYPES, drawGlitch, missions };";

    return new Function("performance", "localStorage", body)(
        { now: function () { return 0; } },
        { getItem: function () { return null; }, setItem: function () {} }
    );
}


/* A canvas that records which drawing calls were made. */
function recordingContext() {

    var calls = [];

    function record(name) {
        return function () { calls.push(name); };
    }

    return {
        calls: calls,
        beginPath: record("beginPath"),
        closePath: record("closePath"),
        moveTo: record("moveTo"),
        lineTo: record("lineTo"),
        arc: record("arc"),
        fill: record("fill"),
        stroke: record("stroke"),
        fillRect: record("fillRect"),
        rect: record("rect"),
        rotate: record("rotate"),
        set fillStyle(v) {}, get fillStyle() { return ""; },
        set strokeStyle(v) {}, get strokeStyle() { return ""; },
        set globalAlpha(v) {}, get globalAlpha() { return 1; },
        set shadowBlur(v) {}, get shadowBlur() { return 0; },
        set lineWidth(v) {}, get lineWidth() { return 1; }
    };
}

function drewSomething(ctx) {
    return ctx.calls.indexOf("fill") !== -1 ||
           ctx.calls.indexOf("fillRect") !== -1;
}


var api = loadRenderer();


/* ---------------------------------------------------
   EVERY SHAPE RENDERS
--------------------------------------------------- */

var shapes = [];

Object.keys(api.ITEM_STYLES).forEach(function (name) {
    var shape = api.ITEM_STYLES[name].shape;
    if (shapes.indexOf(shape) === -1) {
        shapes.push(shape);
    }
});

shapes.forEach(function (shape) {
    var ctx = recordingContext();
    try {
        api.drawItemShape(ctx, shape);
        ok("shape renders: " + shape, drewSomething(ctx));
    } catch (e) {
        ok("shape renders: " + shape + " (" + e.message + ")", false);
    }
});

console.log(shapes.length + " item shapes render: " + shapes.join(", "));

api.GLITCH_TYPES.forEach(function (glitch) {
    var ctx = recordingContext();
    try {
        api.drawGlitch(ctx, glitch.shape, 0);
        ok("glitch renders: " + glitch.shape, drewSomething(ctx));
    } catch (e) {
        ok("glitch renders: " + glitch.shape, false);
    }
});

console.log(api.GLITCH_TYPES.length + " glitch types render: " +
    api.GLITCH_TYPES.map(function (g) { return g.shape; }).join(", "));


/* ---------------------------------------------------
   EVERY ITEM IS DISTINGUISHABLE WITHIN ITS MISSION

   Two items may share a look only when they are the same
   item - mission 10 deliberately spawns Cursed twice, and
   the player is meant to discard both. What must never
   repeat is the full appearance INCLUDING the caption.
--------------------------------------------------- */

console.log("\nper-mission appearance:");

api.missions.forEach(function (mission, index) {

    var items = mission.items.map(function (item) {
        return typeof item === "string" ? { name: item } : item;
    });

    var seen = {};
    var clash = null;

    var rendered = items.map(function (item) {

        var style = api.itemStyle(item);
        var label = api.itemLabel(item);
        var signature = style.color + "|" + style.shape + "|" + label;

        if (seen[signature] && seen[signature] !== item.name) {
            clash = signature;
        }

        seen[signature] = item.name;

        ok("mission " + (index + 1) + ": " + item.name +
            " is not the old fallback green",
            style.color !== "#91ff6f");

        return label + "[" + style.shape + "]";
    });

    ok("mission " + (index + 1) + " has no two different items " +
        "that look identical", clash === null);

    console.log("  " + String(index + 1).padStart(2) + ": " +
        rendered.join(" ") + (clash ? "   <-- CLASH" : ""));
});


console.log("\n" + passed + " passed, " + failed + " failed");

if (failed) {
    process.exit(1);
}
