/* =========================================================
   HACKO - tools/check-wiring.js

   Checks that the suite actually hangs together:

   - every game loads the shared modules
   - every game reports cleared levels to the mission map
   - every game resumes where the player left off
   - map.html can launch each mission it lists
   - every badge image a mission references exists

   Before this, map.html only opened an info modal - it never
   launched anything - and each game wrote progress to its
   own private localStorage key that nothing else read.

       node tools/check-wiring.js
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");

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

function read(file) {
    return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function exists(file) {
    return fs.existsSync(path.join(ROOT, file));
}


/* file -> mission number it reports as */
var GAMES = {
    "theescaperoom.html": 1,
    "thesecretmessage.html": 2,
    "conditionalchallenge.html": 3,
    "looplabyrinth.html": 4,
    "arrayadventure.html": 5,
    "functionfortress.html": 6,
    "classroomrescue.html": 8,
    "loopboss.html": 10
};


/* ---------------------------------------------------
   GAMES
--------------------------------------------------- */

console.log("games");

Object.keys(GAMES).forEach(function (file) {

    var mission = GAMES[file];
    var src = read(file);

    ok(file + " loads audio", src.indexOf("shared/audio.js") !== -1);
    ok(file + " loads storage", src.indexOf("shared/storage.js") !== -1);

    ok(file + " plays sound effects",
        /HackoAudio\.play\(/.test(src));

    var reports = new RegExp(
        "HackoStore\\.completeLevel\\(\\s*" + mission + "\\s*,"
    ).test(src);

    ok(file + " reports levels as mission " + mission, reports);

    ok(file + " registers its level count",
        new RegExp(
            "registerTotalLevels\\(\\s*" + mission + "\\s*,"
        ).test(src));

    ok(file + " resumes and autosaves",
        src.indexOf("RESUME + AUTOSAVE") !== -1 &&
        src.indexOf("bindAutosave") !== -1);

    /* The resume jump must run after the game has booted.
       theescaperoom builds itself in window.onload, so doing
       it at parse time meant loadLevel(0) ran afterwards and
       silently sent the player back to level 1. */
    ok(file + " applies resume after boot, not at parse time",
        /goToSavedLevel/.test(src) &&
        /addEventListener\("load"|readyState === "complete"/.test(src));

    ok(file + " has a background track and a sound toggle",
        src.indexOf("SOUND LAYER") !== -1 &&
        /HackoAudio\.music\.play\("\w+"\)/.test(src) &&
        src.indexOf("mountToggle") !== -1);

    /* The index passed to completeLevel has to be a real
       variable in that game, not a hopeful guess. */
    var call = src.match(
        new RegExp(
            "HackoStore\\.completeLevel\\(\\s*" + mission +
            "\\s*,\\s*([^,]+),"
        )
    );

    if (call) {

        var expression = call[1].trim();
        var root = expression.split(/[.\s()\[-]/)[0];

        /* how many times the identifier appears outside our
           own inserted lines */
        var others = src
            .split("\n")
            .filter(function (line) {
                return line.indexOf("HackoStore.") === -1 &&
                       new RegExp("\\b" + root + "\\b").test(line);
            })
            .length;

        ok(file + " level index '" + expression + "' is a real variable",
            others > 0, root + " seen on " + others + " other lines");
    }
});


/* ---------------------------------------------------
   MAP
--------------------------------------------------- */

console.log("\nmission map");

var map = read("map.html");

ok("map loads the shared store", map.indexOf("shared/storage.js") !== -1);
ok("map has a PLAY button", map.indexOf("playMission()") !== -1);
ok("map uses the 70% gate", map.indexOf("HackoStore.isUnlocked") !== -1);
ok("map requires a signed-in player",
    map.indexOf("login.html") !== -1);

/* every mission that names a file must have that file */
var fileRe = /title:\s*"([^"]+)"[\s\S]{0,500}?file:\s*"([^"]*)"/g;
var match;
var listed = 0;
var playable = 0;

while ((match = fileRe.exec(map)) !== null) {

    listed += 1;

    var title = match[1];
    var file = match[2];

    if (!file) {
        console.log("        " + title + " - not built yet");
        continue;
    }

    playable += 1;
    ok("map can launch " + title, exists(file), file + " missing");
}

ok("map lists 10 missions", listed === 10, "found " + listed);
console.log("  " + playable + " of " + listed + " missions are playable");


/* ---------------------------------------------------
   BADGES
--------------------------------------------------- */

console.log("\nbadges");

var badges = map.match(/Badges\/[A-Za-z0-9_.]+/g) || [];
var unique = badges.filter(function (b, i) {
    return badges.indexOf(b) === i;
});

unique.forEach(function (badge) {
    ok("badge image exists: " + badge, exists(badge));
});

console.log("  " + unique.length + " badge images referenced");


/* ---------------------------------------------------
   LOGIN
--------------------------------------------------- */

console.log("\nsign in");

var login = read("login.html");

ok("login uses the shared store", login.indexOf("HackoStore.login") !== -1);
ok("login can export progress", login.indexOf("exportToFile") !== -1);
ok("login can import progress", login.indexOf("importFile") !== -1);
ok("login sends players to the map", login.indexOf("map.html") !== -1);
ok("login is honest about not being secure",
    /not a security feature/i.test(login));
ok("login has music and a sound toggle",
    login.indexOf("SOUND LAYER") !== -1);

var mapPage = read("map.html");
ok("map has music and a sound toggle",
    mapPage.indexOf("SOUND LAYER") !== -1);


console.log("\n" + passed + " passed, " + failed + " failed");

if (failed) {
    process.exit(1);
}
