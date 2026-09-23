/* Runs every HACKO check. node tools/test-all.js */
"use strict";

var cp = require("child_process");
var path = require("path");

var SUITES = [
    ["shared modules", "test-shared.js"],
    ["maze solvability", "check-mazes.js"],
    ["item artwork", "check-items.js"],
    ["jump reachability", "check-jumps.js"],
    ["Java interpreter", "test-javaloop.js"],
    ["Loop Dungeon shields", "check-shields.js"],
    ["Java lesson content", "check-java.js"],
    ["suite wiring", "check-wiring.js"]
];

var failed = 0;

SUITES.forEach(function (suite) {

    var result = cp.spawnSync(
        process.execPath,
        [path.join(__dirname, suite[1])],
        { encoding: "utf8" }
    );

    var passLine = (result.stdout || "")
        .split("\n")
        .filter(function (l) { return /passed|solvable|comfortable/.test(l); })
        .pop() || "";

    if (result.status === 0) {
        console.log("  PASS  " + suite[0] + "  -  " + passLine.trim());
    } else {
        failed += 1;
        console.log("  FAIL  " + suite[0]);
        console.log(result.stdout);
    }
});

console.log(
    failed
        ? "\n" + failed + " suite(s) failing"
        : "\nall " + SUITES.length + " suites passing"
);

process.exit(failed ? 1 : 0);
