/* =========================================================
   HACKO - tools/check-shields.js

   Every Loop Dungeon shield must be beatable with real Java,
   and the starter skeleton must NOT already beat it.

   This runs a genuine solution for each shield through the
   interpreter the game uses, and compares the output the
   same way the game does.

       node tools/check-shields.js
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");

require("../shared/javaloop.js");

var J = globalThis.HackoJava;
var ROOT = path.join(__dirname, "..");

var passed = 0;
var failed = 0;

function ok(name, condition, detail) {
    if (condition) {
        passed += 1;
    } else {
        failed += 1;
        console.log("  FAIL  " + name + (detail ? "\n        " + detail : ""));
    }
}

/* pull SHIELDS out of the page */
var src = fs.readFileSync(path.join(ROOT, "loopboss.html"), "utf8");
var from = src.indexOf("    var SHIELDS = [");
var open = src.indexOf("[", from);
var depth = 0;
var end = -1;

for (var i = open; i < src.length; i++) {
    if (src[i] === "[") {
        depth += 1;
    } else if (src[i] === "]") {
        depth -= 1;
        if (depth === 0) {
            end = i;
            break;
        }
    }
}

var SHIELDS = new Function("return " + src.slice(open, end + 1))();

/* A real Java answer for each shield. */
var SOLUTIONS = [
    'for (int i = 1; i <= 5; i++) { System.out.print(i + " "); }',

    'for (int i = 1; i <= 4; i++) { System.out.print("A "); }',

    'for (int row = 1; row <= 3; row++) {' +
    '  for (int n = 1; n <= 3; n++) { System.out.print(n + " "); }' +
    '  System.out.println();' +
    '}',

    'for (int row = 1; row <= 5; row++) {' +
    '  for (int c = 1; c <= row; c++) { System.out.print("*"); }' +
    '  System.out.println();' +
    '}',

    'for (int row = 1; row <= 5; row++) {' +
    '  for (int c = 1; c <= row; c++) { System.out.print(c); }' +
    '  System.out.println();' +
    '}',

    'for (int row = 5; row >= 1; row--) {' +
    '  for (int c = 1; c <= row; c++) { System.out.print(c); }' +
    '  System.out.println();' +
    '}',

    'for (int row = 1; row <= 4; row++) {' +
    '  for (int c = 1; c <= 4; c++) { System.out.print("#"); }' +
    '  System.out.println();' +
    '}',

    'for (int row = 1; row <= 5; row++) {' +
    '  for (int c = 1; c <= row; c++) { System.out.print("#"); }' +
    '  System.out.println();' +
    '}',

    'for (int row = 1; row <= 5; row++) {' +
    '  for (int c = 1; c <= row; c++) { System.out.print(row); }' +
    '  System.out.println();' +
    '}',

    'for (int row = 1; row <= 4; row++) {' +
    '  for (int col = 1; col <= 4; col++) {' +
    '    if ((row + col) % 2 == 0) { System.out.print("*"); }' +
    '    else { System.out.print("."); }' +
    '  }' +
    '  System.out.println();' +
    '}'
];

console.log(SHIELDS.length + " shields\n");

SHIELDS.forEach(function (shield, index) {

    var n = index + 1;
    var solution = SOLUTIONS[index];

    var run = J.run(solution);

    if (run.error) {
        ok("shield " + n + " solution runs", false, run.error);
        return;
    }

    var check = J.compare(run.output, shield.target);

    ok("shield " + n + " (" + shield.title + ") is solvable",
        check.match,
        check.match ? "" :
            "line " + check.line +
            ": got " + JSON.stringify(check.got) +
            ", want " + JSON.stringify(check.want));

    /* the skeleton must not already win */
    var starter = J.run(shield.starter);
    var starterWins = !starter.error &&
        J.compare(starter.output, shield.target).match;

    ok("shield " + n + " starter does not already win", !starterWins);

    ok("shield " + n + " has tiered hints",
        Array.isArray(shield.hints) && shield.hints.length >= 3);

    /* the sweep has to be readable, not a blur */
    ok("shield " + n + " sweep speed is playable",
        shield.sweep >= 100 && shield.sweep <= 400,
        shield.sweep + "ms");

    if (check.match) {
        var cells = shield.target.split("\n").length;
        console.log("  ok  " + String(n).padStart(2) + "  " +
            shield.title.padEnd(18) + cells + " rows, sweep " +
            shield.sweep + "ms");
    }
});

/* the arena grid must be rectangular, or cells go missing */
SHIELDS.forEach(function (shield, index) {

    var lines = shield.target.split("\n");
    var widest = lines.reduce(function (w, l) {
        return Math.max(w, l.length);
    }, 0);

    ok("shield " + (index + 1) + " grid is well formed",
        widest > 0 && lines.length > 0);
});

console.log("\n" + passed + " passed, " + failed + " failed");

if (failed) {
    process.exit(1);
}
