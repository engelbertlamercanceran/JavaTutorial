/* =========================================================
   HACKO - tools/check-shields.js

   Every Loop Master phase must be beatable with real Java,
   and each must actually REQUIRE the loop shape it teaches.

   Two properties matter more than "is it solvable":

   1. The while phases re-roll their numbers on every attempt,
      so a hardcoded count has to fail most of the time. If it
      does not, the phase teaches nothing.

   2. The do-while phases start with a false condition, so a
      while loop must plan NOTHING and lose. That is the only
      honest demonstration of why do-while exists.

   Phase 10 is the finale: the Loop Master robot walks in while
   the player solves a run of rounds back to back. Every round
   gets the same treatment as a phase.

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
        console.log("  FAIL  " + name + (detail ? "  (" + detail + ")" : ""));
    }
}


/* pull PHASES out of the page */
var src = fs.readFileSync(path.join(ROOT, "loopboss.html"), "utf8");
var from = src.indexOf("    var PHASES = [");
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

/* the phase data leans on two helpers declared above it */
function times(move, n) {
    var out = [];
    for (var t = 0; t < n; t++) {
        out.push(move);
    }
    return out.join("\n");
}

function between(low, high) {
    return low + Math.floor(Math.random() * (high - low + 1));
}

var PHASES = new Function(
    "times", "between",
    "return " + src.slice(open, end + 1)
)(times, between);


/* a real Java answer for each phase */
var SOLUTIONS = [
    'for (int i = 1; i <= 3; i++) { System.out.println("BLOCK"); }',

    'for (int i = 1; i <= 7; i++) { System.out.println("BLOCK"); }',

    'while (rage > 0) { System.out.println("BLOCK"); rage--; }',

    'while (shield > 0) { System.out.println("STRIKE"); shield--; }',

    'do { System.out.println("BLOCK"); rage--; } while (rage > 0);',

    'do { System.out.println("BLOCK"); fury--; } while (fury > 0);',

    'for (int i = 1; i <= 6; i++) {' +
    '  if (i % 2 == 1) { System.out.println("BLOCK"); }' +
    '  else { System.out.println("DODGE"); } }',

    'for (int w = 1; w <= 3; w++) {' +
    '  for (int b = 1; b <= 4; b++) { System.out.println("BLOCK"); }' +
    '  System.out.println("HOLD"); }',

    'while (guard > 0) { System.out.println("STRIKE"); guard--; }' +
    ' System.out.println("BLOCK");',

    null    /* phase 10 is the finale - see FINALE_SOLUTIONS */
];

/* a real Java answer for each round of the finale */
var FINALE_SOLUTIONS = [
    'for (int i = 1; i <= 5; i++) { System.out.println("CHARGE"); }',

    'while (armor > 0) { System.out.println("HIT"); armor--; }',

    'do { System.out.println("SMASH"); core--; } while (core > 0);',

    'for (int i = countdown; i >= 1; i--) { System.out.println(i); }' +
    ' System.out.println("FIRE");',

    'for (int w = 1; w <= 4; w++) {' +
    '  for (int b = 1; b <= w; b++) { System.out.println("BLOCK"); }' +
    '  System.out.println("HOLD"); }' +
    ' System.out.println("ENDURE");'
];

/* phases whose numbers move between attempts */
var RANDOMISED = [2, 3, 5, 8];

/* phases where a while loop must plan nothing at all */
var DO_WHILE = [4];


function declare(vars) {
    return Object.keys(vars).map(function (name) {
        return "int " + name + " = " + vars[name] + ";";
    }).join("\n");
}

/* mirrors fight() in the page */
function play(phase, source, vars) {

    var run = J.run(declare(vars) + "\n" + source);

    if (run.error) {
        return { error: run.error, moves: 0, survived: false };
    }

    var mine = run.output
        .replace(/\s+$/, "")
        .split("\n")
        .filter(function (line) { return line.trim().length; });

    var want = phase.expected(vars).split("\n");

    return {
        error: null,
        moves: mine.length,
        survived: mine.length === want.length &&
            mine.every(function (move, index) { return move === want[index]; })
    };
}


console.log(PHASES.length + " phases\n");

/* the finale's rounds are checked like phases, numbered 10.1, 10.2... */
var FIGHTS = [];

PHASES.forEach(function (phase, index) {
    if (phase.finale) {
        phase.rounds.forEach(function (round, r) {
            FIGHTS.push({ n: (index + 1) + "." + (r + 1), phase: round, solution: FINALE_SOLUTIONS[r] });
        });
    } else {
        FIGHTS.push({ n: String(index + 1), phase: phase, solution: SOLUTIONS[index] });
    }
});

var finale = PHASES.filter(function (phase) { return phase.finale; })[0];

ok("phase 10 is the Loop Master finale", PHASES.indexOf(finale) === 9);
ok("the finale has a round for every point of the boss's life",
    finale && finale.rounds.length === FINALE_SOLUTIONS.length && finale.rounds.length >= 5,
    finale && finale.rounds.length + " rounds");

FIGHTS.forEach(function (fight) {

    var phase = fight.phase;
    var n = fight.n;
    var wins = 0;
    var problem = null;

    for (var attempt = 0; attempt < 8; attempt++) {

        var vars = phase.setup();
        var result = play(phase, fight.solution, vars);

        if (result.error) {
            problem = result.error;
            break;
        }

        if (result.survived) {
            wins += 1;
        }
    }

    ok("phase " + n + " (" + phase.title + ") is beatable every time",
        problem === null && wins === 8,
        problem || (wins + "/8 attempts survived"));

    var starter = play(phase, phase.starter, phase.setup());

    ok("phase " + n + " starter does not already win", !starter.survived);

    ok("phase " + n + " has tiered hints",
        Array.isArray(phase.hints) && phase.hints.length >= 3);

    if (problem === null && wins === 8) {
        console.log("  ok  " + n.padStart(4) + "  " + phase.title);
    }
});


console.log("\nthe finale's while rounds must punish a hardcoded count");

[
    [1, 'for (int i = 1; i <= 5; i++) { System.out.println("HIT"); }'],
    [3, 'for (int i = 5; i >= 1; i--) { System.out.println(i); } System.out.println("FIRE");']
].forEach(function (pair) {

    var round = finale.rounds[pair[0]];
    var survived = 0;

    /* 40 tries keeps a one-in-five lucky guess from flaking */
    for (var attempt = 0; attempt < 40; attempt++) {
        if (play(round, pair[1], round.setup()).survived) {
            survived += 1;
        }
    }

    ok(round.title + ": a fixed count of 5 usually fails",
        survived <= 16, "survived " + survived + "/40");

    console.log("  " + round.title.padEnd(18) +
        "hardcoded guess survived " + survived + "/40");
});

(function () {

    var round = finale.rounds[2];
    var withWhile = play(round,
        'while (core > 0) { System.out.println("SMASH"); core--; }', { core: 0 });

    ok(round.title + ": a while loop loses when core is 0",
        withWhile.moves === 0 && !withWhile.survived, "planned " + withWhile.moves);

    console.log("  " + round.title + ": with core 0 a while loop planned " +
        withWhile.moves + " moves");
}());


console.log("\nthe while phases must punish a hardcoded count");

RANDOMISED.forEach(function (index) {

    var phase = PHASES[index];
    var guess = 'for (int i = 1; i <= 5; i++) { System.out.println("BLOCK"); }';
    var survived = 0;

    for (var attempt = 0; attempt < 20; attempt++) {
        if (play(phase, guess, phase.setup()).survived) {
            survived += 1;
        }
    }

    ok(phase.title + ": a fixed count of 5 usually fails",
        survived <= 8, "survived " + survived + "/20");

    console.log("  " + phase.title.padEnd(18) +
        "hardcoded guess survived " + survived + "/20");
});


console.log("\nthe do-while phases must defeat a while loop");

DO_WHILE.forEach(function (index) {

    var phase = PHASES[index];
    var vars = phase.setup();

    var withWhile = play(phase,
        'while (rage > 0) { System.out.println("BLOCK"); rage--; }', vars);

    var withDoWhile = play(phase,
        'do { System.out.println("BLOCK"); rage--; } while (rage > 0);', vars);

    ok(phase.title + ": a while loop plans nothing",
        withWhile.moves === 0, "planned " + withWhile.moves);

    ok(phase.title + ": do-while plans exactly one move and wins",
        withDoWhile.moves === 1 && withDoWhile.survived,
        "planned " + withDoWhile.moves);

    console.log("  " + phase.title + ": while planned " + withWhile.moves +
        " moves, do-while planned " + withDoWhile.moves);
});


console.log("\n" + passed + " passed, " + failed + " failed");

if (failed) {
    process.exit(1);
}
