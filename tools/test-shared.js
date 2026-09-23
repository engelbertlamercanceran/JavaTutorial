/* =========================================================
   HACKO - tools/test-shared.js

   Tests for shared/storage.js and shared/hint.js.

       node tools/test-shared.js

   The hint tests use the real strings that used to leak
   answers in the shipped games, so if anyone reintroduces a
   hint like "The door code is 42" this suite fails.
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");

var SHARED = path.join(__dirname, "..", "shared");

var passed = 0;
var failed = 0;

function ok(name, condition) {
    if (condition) {
        passed += 1;
        console.log("  PASS  " + name);
    } else {
        failed += 1;
        console.log("  FAIL  " + name);
    }
}

function section(title) {
    console.log("\n" + title);
}


/* ---------------------------------------------------
   HARNESS
--------------------------------------------------- */

function fakeWindow(seed) {

    var store = Object.assign({}, seed || {});

    return {
        localStorage: {
            getItem: function (k) {
                return Object.prototype.hasOwnProperty.call(store, k)
                    ? store[k]
                    : null;
            },
            setItem: function (k, v) { store[k] = String(v); },
            removeItem: function (k) { delete store[k]; }
        },
        addEventListener: function () {},
        document: { visibilityState: "visible" },
        console: console
    };
}

function loadModule(file, win) {
    var src = fs.readFileSync(path.join(SHARED, file), "utf8");
    new Function("window", src)(win);
    return win;
}

function newStore(seed) {
    var win = fakeWindow(seed);
    loadModule("storage.js", win);
    return win.HackoStore;
}


/* ---------------------------------------------------
   STORAGE - ACCOUNTS
--------------------------------------------------- */

section("accounts");
(function () {

    var S = newStore();

    S.login("maria");
    ok("login sets the active user", S.activeUser() === "maria");

    S.login("jun");
    ok("both users are listed",
        JSON.stringify(S.listUsers()) === '["maria","jun"]');

    S.completeLevel(1, 0, 50);
    ok("jun has one level done", S.mission(1).levelsDone.length === 1);

    S.login("maria");
    ok("maria's profile is separate", S.mission(1).levelsDone.length === 0);

    S.login("jun");
    ok("jun's progress survived the switch",
        S.mission(1).levelsDone.length === 1);

    S.logout();
    ok("logout clears the active user", S.isLoggedIn() === false);
}());


/* ---------------------------------------------------
   STORAGE - THE 70% GATE
--------------------------------------------------- */

section("70% unlock gate");
(function () {

    var S = newStore();
    S.login("t");
    S.registerTotalLevels(1, 10);

    ok("mission 1 is always unlocked", S.isUnlocked(1) === true);
    ok("mission 2 starts locked", S.isUnlocked(2) === false);

    for (var i = 0; i < 6; i++) {
        S.completeLevel(1, i, 10);
    }

    ok("6 of 10 is not enough", S.isUnlocked(2) === false);

    S.completeLevel(1, 6, 10);

    ok("7 of 10 unlocks the next mission", S.isUnlocked(2) === true);
    ok("completion reports 70%", S.completion(1).percent === 70);
    ok("badge is NOT earned at 70%", S.mission(1).badge === false);
    ok("mission is not marked complete at 70%",
        S.mission(1).completed === false);

    for (var j = 7; j < 10; j++) {
        S.completeLevel(1, j, 10);
    }

    ok("badge is earned at 100%", S.mission(1).badge === true);
    ok("badge name is recorded",
        S.load().badges.indexOf("VARIABLE HERO") !== -1);
    ok("XP totalled correctly", S.load().totalXP === 100);

    S.completeLevel(1, 3, 10);
    ok("replaying a level does not award XP twice",
        S.load().totalXP === 100);
}());


/* ---------------------------------------------------
   STORAGE - RESUME
--------------------------------------------------- */

section("resume after leaving mid-mission");
(function () {

    var S = newStore();
    S.login("t");

    S.completeLevel(4, 0, 10);
    S.completeLevel(4, 1, 10);
    S.setResumeLevel(4, 5);
    S.setLives(4, 2);

    ok("resume level persists", S.getResumeLevel(4) === 5);
    ok("lives persist", S.getLives(4) === 2);
    ok("finished levels are untouched", S.mission(4).levelsDone.length === 2);
    ok("lives default to 3 for a fresh mission", S.getLives(7) === 3);
}());


/* ---------------------------------------------------
   STORAGE - LEGACY MIGRATION
--------------------------------------------------- */

section("migration from the old per-game keys");
(function () {

    var S = newStore({
        hackoArrayProgress: JSON.stringify({ unlocked: 4, done: [0, 1, 2] }),
        hackoSecretMessageProgress: JSON.stringify({ completedLevels: [0, 1] }),
        hackoProgress: JSON.stringify({ completedMissions: [1], totalXP: 250 })
    });

    S.login("old");

    ok("hackoArrayProgress became mission 5",
        S.mission(5).levelsDone.join(",") === "0,1,2");
    ok("hackoSecretMessageProgress became mission 2",
        S.mission(2).levelsDone.join(",") === "0,1");
    ok("an old completed mission fills all its levels",
        S.mission(1).levelsDone.length === 10);
    ok("an old completed mission keeps its badge",
        S.mission(1).badge === true);
    ok("old XP carried over", S.load().totalXP === 250);
    ok("migrated progress unlocks the next mission",
        S.isUnlocked(2) === true);
}());


/* ---------------------------------------------------
   STORAGE - HOSTILE ENVIRONMENT
--------------------------------------------------- */

section("storage unavailable (private browsing)");
(function () {

    var win = {
        localStorage: {
            getItem: function () { throw new Error("denied"); },
            setItem: function () { throw new Error("denied"); },
            removeItem: function () { throw new Error("denied"); }
        },
        addEventListener: function () {},
        document: {}
    };

    var threw = false;

    try {
        loadModule("storage.js", win);
        win.HackoStore.login("x");
        win.HackoStore.mission(1);
        win.HackoStore.completeLevel(1, 0, 10);
    } catch (e) {
        threw = true;
    }

    ok("never throws when localStorage is blocked", threw === false);
}());


/* ---------------------------------------------------
   HINTS - THE REAL LEAKS FROM THE SHIPPED GAMES
--------------------------------------------------- */

section("hints that used to give away the answer");
(function () {

    var win = { console: console };
    loadModule("hint.js", win);
    var H = win.HackoHint;

    var leaks = [
        ["escape room door code", "The door code is 42.", 42],
        ["escape room password", 'Password = "admin".', "admin"],
        ["escape room boolean", "The lock is open, which means true.", "true"],
        ["escape room height", "Safe height = 1.85.", 1.85],
        ["secret message code", "The digital door access code is 42.", "42"],
        ["secret message symbol", "The secret security symbol is X.", "X"],
        ["loop labyrinth starter code",
            "for (int i = 0; i < 3; i++)", "for (int i = 0; i < 3; i++)"]
    ];

    leaks.forEach(function (row) {
        ok("caught: " + row[0], H.leaks(row[1], row[2]) !== null);
    });

    var safe = [
        ["conceptual nudge",
            "The keypad log shows the code was entered twice - " +
            "check the terminal readout.", 42],
        ["structure only",
            "A for loop needs a start, a stop and a step.",
            "for (int i = 0; i < 5; i++)"],
        ["a different worked example",
            "Example: for (int n = 1; n <= 3; n++) prints 1, 2, 3.",
            "for (int i = 0; i < 5; i++)"],
        ["shares only short keywords",
            "Declare the variable with its type first.", "int score = 100;"]
    ];

    safe.forEach(function (row) {
        ok("allowed: " + row[0], H.leaks(row[1], row[2]) === null);
    });
}());


section("hint tiers");
(function () {

    var win = { console: { warn: function () {} } };
    loadModule("hint.js", win);
    var H = win.HackoHint;

    var hint = H.forPuzzle({
        id: "t",
        answer: 42,
        tiers: [
            "Look at the terminal readout.",
            "The value is entered twice.",
            "Example: a two-digit code like 17 would be typed 17."
        ]
    });

    var first = hint.next();
    hint.next();
    var third = hint.next();

    ok("tier 0 is the nudge", first.tier === 0 && first.name === "Nudge");
    ok("tier 2 is flagged as the last", third.last === true);
    ok("hint is exhausted after three", hint.exhausted === true);
    ok("asking again repeats the last tier", hint.next().tier === 2);

    hint.reset();
    ok("reset returns to tier 0", hint.tier === 0);

    var leaky = H.forPuzzle({
        id: "leaky",
        answer: 42,
        tiers: ["The door code is 42."]
    });

    var blocked = leaky.next();

    ok("a leaking tier is blocked at runtime",
        blocked.text.indexOf("42") === -1);

    var problems = H.audit([
        { id: "m1-l1", answer: 42,
          tiers: ["The door code is 42.", "Check the readout."] },
        { id: "m1-l2", answer: "admin",
          tiers: ["Think about the default account name."] }
    ]);

    ok("audit finds exactly the one bad tier",
        problems.length === 1 &&
        problems[0].id === "m1-l1" &&
        problems[0].tier === 0);
}());


/* ---------------------------------------------------
   RESULT
--------------------------------------------------- */

console.log("\n" + passed + " passed, " + failed + " failed");

if (failed) {
    process.exit(1);
}
