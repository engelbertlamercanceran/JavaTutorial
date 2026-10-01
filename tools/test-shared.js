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
            removeItem: function (k) { delete store[k]; },
            key: function (i) { return Object.keys(store)[i] || null; },
            get length() { return Object.keys(store).length; }
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

section("a new player never inherits old progress");
(function () {

    var win = fakeWindow({
        hackoGameState: JSON.stringify({ completed: [1, 2, 3, 4, 5, 6, 7] }),
        hackoArrayProgress: JSON.stringify({ unlocked: 4, done: [0, 1, 2] })
    });

    loadModule("storage.js", win);

    var S = win.HackoStore;
    var ls = win.localStorage;

    S.login("first");
    ok("the first player gets the pre-account progress",
        S.mission(7).completed === true);

    /* the games keep writing their own keys while you play */
    ls.setItem("hackoLoopProgress", JSON.stringify({ completed: [0, 1] }));

    S.deleteUser("first");
    S.login("newbie");

    ok("a player created after deleting everyone starts blank",
        Object.keys(S.load().missions).length === 0);
    ok("...and their games see no old level progress",
        ls.getItem("hackoGameState") === null &&
        ls.getItem("hackoArrayProgress") === null &&
        ls.getItem("hackoLoopProgress") === null);

    ls.setItem("hackoArrayProgress", JSON.stringify({ unlocked: 2, done: [0] }));
    S.logout();
    S.login("other");

    ok("a second player does not see the first one's game keys",
        ls.getItem("hackoArrayProgress") === null &&
        Object.keys(S.load().missions).length === 0);

    S.login("newbie");
    ok("switching back restores that player's game keys",
        JSON.parse(ls.getItem("hackoArrayProgress")).done.join(",") === "0");

    S.deleteUser("newbie");
    S.login("newbie");
    ok("map reset (delete + login same name) starts blank",
        Object.keys(S.load().missions).length === 0 &&
        ls.getItem("hackoArrayProgress") === null);
}());

section("browsers migrated by an older build do not re-import");
(function () {

    var S = newStore({
        "hacko:migrated:gone": "true",
        hackoProgress: JSON.stringify({ completedMissions: [1, 2], totalXP: 900 })
    });

    S.login("fresh");
    ok("old per-player flag counts as migrated",
        Object.keys(S.load().missions).length === 0 &&
        S.load().totalXP === 0);
}());


/* ---------------------------------------------------
   HINT POINTS
--------------------------------------------------- */

section("hint points");
(function () {

    var win = fakeWindow();
    loadModule("storage.js", win);
    loadModule("hint.js", win);

    var S = win.HackoStore;
    var H = win.HackoHint;

    S.login("h");

    ok("a new player starts with 3 hint points", S.hintBalance() === 3);

    S.completeLevel(4, 0, 100);
    ok("clearing a level in a hint game earns 1", S.hintBalance() === 4);

    S.completeLevel(4, 0, 100);
    ok("replaying a level earns nothing", S.hintBalance() === 4);

    S.completeLevel(1, 0, 100);
    ok("a game without hints earns nothing", S.hintBalance() === 4);

    var hint = H.paid({ id: "m4-l1", tiers: ["nudge", "structure", "example"] });

    var first = hint.next();
    ok("buying a hint shows it", first.ok && first.text === "nudge");
    ok("buying a hint costs 1 point", S.hintBalance() === 3 && first.charged);

    var again = H.paid({ id: "m4-l1", tiers: ["nudge", "structure", "example"] });
    var reread = again.next();
    ok("a bought hint is free to read again later",
        reread.ok && !reread.charged && S.hintBalance() === 3);
    ok("the label says the next owned tier is free",
        H.paid({ id: "m4-l1", tiers: ["a", "b"] }).label().indexOf("free") !== -1);

    again.next();
    again.next();
    ok("all three tiers bought leaves 1 point", S.hintBalance() === 1);

    var repeat = again.next();
    ok("reading past the last tier is free",
        repeat.ok && !repeat.charged && S.hintBalance() === 1);

    var other = H.paid({ id: "m9-l1", tiers: ["x", "y"] });
    other.next();
    var broke = other.next();
    ok("with no points left the hint is refused", broke.ok === false);
    ok("a refused hint costs nothing", S.hintBalance() === 0);

    S.completeLevel(9, 0, 100);
    ok("clearing another level earns the next hint",
        other.next().ok === true && S.hintBalance() === 0);

    ok("hint points leave the XP score alone", S.load().totalXP === 300);

    var saved = JSON.parse(win.localStorage.getItem("hacko:user:h"));
    /* 3 tiers of m4-l1, then 2 tiers of m9-l1 */
    ok("spent points survive a reload", saved.hintSpent === 5);

    S.login("fresh");
    ok("points are per player", S.hintBalance() === 3);

    var loose = fakeWindow();
    loadModule("hint.js", loose);
    ok("without a signed-in player hints are free",
        loose.HackoHint.paid({ id: "x", tiers: ["t"] }).next().ok === true);
}());


/* ---------------------------------------------------
   CERTIFICATE
--------------------------------------------------- */

section("certificate");
(function () {

    var S = newStore();
    S.login("c");

    function finish(mission) {
        for (var i = 0; i < 10; i++) {
            S.completeLevel(mission, i, 10);
        }
    }

    for (var m = 1; m <= 9; m++) {
        finish(m);
    }

    ok("nine of ten missions is not enough", S.hasCertificate() === false);
    ok("no certificate details before it is earned", S.certificate() === null);

    for (var i = 0; i < 9; i++) {
        S.completeLevel(10, i, 10);
    }

    ok("the last mission at 90% is not enough", S.hasCertificate() === false);

    S.completeLevel(10, 9, 10);

    ok("all ten missions at 100% earns it", S.hasCertificate() === true);

    var info = S.certificate();
    ok("it names the player", info && info.username === "c");
    ok("it records the date it was earned", info && !isNaN(Date.parse(info.date)));
    ok("the date stays the same on a replay",
        (S.completeLevel(4, 0, 10), S.certificate().date === info.date));
    ok("it lists all ten badges", info && info.badges.length === 10);

    S.login("other");
    ok("certificates are per player", S.hasCertificate() === false);
}());


section("badge art");
(function () {

    var win = fakeWindow();
    loadModule("badgeart.js", win);
    var A = win.HackoBadgeArt;

    var ranks = [];

    for (var n = 1; n <= 10; n++) {
        var svg = A.svg(n);
        ok("badge " + n + " draws", /^<svg[\s\S]*<\/svg>$/.test(svg));
        ok("badge " + n + " carries its name", svg.indexOf(A.NAMES[n]) !== -1);
        ranks.push(A.TIERS.indexOf(A.tierOf(n)));
    }

    ok("ranks never go down along the course",
        ranks.every(function (r, i) { return i === 0 || r >= ranks[i - 1]; }));
    ok("the final boss has the top rank", A.tierOf(10) === "IMMORTAL");

    var one = A.svg(1);
    var two = A.svg(1);
    ok("two copies on one page never share gradient ids",
        one.match(/id='(hkb\d+_)/)[1] !== two.match(/id='(hkb\d+_)/)[1]);
    ok("an unknown mission draws nothing", A.svg(11) === "");
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
