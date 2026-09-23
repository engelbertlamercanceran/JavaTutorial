/* =========================================================
   HACKO - tools/check-java.js

   Two things this guards:

   1. The PUZZLE CONTENT is really Java. Classroom Rescue
      shipped its "Java" lessons written in PHP ($robo,
      ->unlock, __construct, public $energy), and Loop
      Labyrinth taught loops in JavaScript (let, console.log).
      On a Java course that is worse than any bug the client
      reported. Only the lesson data is scanned - the game
      engines are of course JavaScript and that is fine.

   2. Each level still works after the rewrite: a correct
      Java answer passes, and the starter skeleton the player
      is given does NOT. The starters used to BE the answers,
      so pressing RUN won every level instantly.

       node tools/check-java.js
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");

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


/* Pulls one array literal out of a page by name. */
function extractArray(source, declaration) {

    var from = source.indexOf(declaration);

    if (from === -1) {
        return null;
    }

    var open = source.indexOf("[", from);
    var depth = 0;

    for (var i = open; i < source.length; i++) {
        if (source[i] === "[") {
            depth += 1;
        } else if (source[i] === "]") {
            depth -= 1;
            if (depth === 0) {
                return source.slice(open, i + 1);
            }
        }
    }

    return null;
}

function read(file) {
    return fs.readFileSync(path.join(ROOT, file), "utf8");
}


/* ---------------------------------------------------
   1. NO FOREIGN LANGUAGE IN PUZZLE CONTENT
--------------------------------------------------- */

/* The first version of this check only looked for $x->y and
   missed Loop Boss entirely, which taught every loop in PHP
   using bare $i and echo. Keep these broad. */
var FOREIGN = [
    { pattern: /\$[a-zA-Z_]\w*\s*->/, name: "PHP object access ($x->y)" },
    { pattern: /__construct/, name: "PHP constructor" },
    { pattern: /public\s+\$\w+/, name: "PHP property" },
    { pattern: /\$[a-zA-Z_]\w*/, name: "PHP variable ($x)" },
    { pattern: /\becho\b/, name: "PHP echo" },
    { pattern: /\bconsole\s*\.\s*log\b/, name: "JavaScript console.log" },
    { pattern: /\blet\s+\w+\s*=/, name: "JavaScript let declaration" },
    { pattern: /\bfunction\s+\w+\s*\(/, name: "JavaScript function declaration" },
    { pattern: /\bconst\s+\w+\s*=/, name: "JavaScript const declaration" },
    { pattern: /[^=!<>]===/, name: "JavaScript strict equality (===)" }
];

/* file -> the declaration holding its lesson content */
var CONTENT = [
    ["classroomrescue.html", "const levels = ["],
    ["looplabyrinth.html", "const challenges = ["],
    ["loopboss.html", "var SHIELDS = ["],
    ["theescaperoom.html", "const LEVELS"],
    ["thesecretmessage.html", "const LEVELS"],
    ["conditionalchallenge.html", "const LEVELS"],
    ["arrayadventure.html", "const missions"],
    ["functionfortress.html", "const missions"]
];

/* Only the fields a player actually reads. A mission's
   validate() arrow function is engine code and is of course
   JavaScript - scanning the whole data block flagged those
   and buried the real findings. */
var SHOWN_FIELDS = [
    "starter", "solution", "reference", "rule", "pattern", "code"
];

function shownText(block) {

    var out = [];

    SHOWN_FIELDS.forEach(function (field) {

        var re = new RegExp(
            field + "\\s*:\\s*(`[^`]*`|\"[^\"]*\"|'[^']*')",
            "g"
        );

        var match;

        while ((match = re.exec(block)) !== null) {
            out.push(match[1]);
        }
    });

    return out.join("\n");
}

console.log("language check (text shown to players)");

CONTENT.forEach(function (entry) {

    var file = entry[0];
    var declaration = entry[1];

    if (!fs.existsSync(path.join(ROOT, file))) {
        return;
    }

    var block = extractArray(read(file), declaration);

    if (!block) {
        ok(file + ": found its lesson data", false);
        return;
    }

    var text = shownText(block);

    FOREIGN.forEach(function (rule) {

        var hit = rule.pattern.test(text);

        ok(file + " shows no " + rule.name, !hit);

        if (hit) {
            var line = text.split("\n").filter(function (l) {
                return rule.pattern.test(l);
            })[0];
            console.log("        " + (line || "").trim().slice(0, 90));
        }
    });
});


/* ---------------------------------------------------
   2. CLASSROOM RESCUE - CLASSES AND OBJECTS
--------------------------------------------------- */

var crLevels = new Function(
    extractArray(read("classroomrescue.html"), "const levels = [")
        .replace(/^\[/, "return [")
)();

var CR_SOLUTIONS = [
    "class Robot { int energy; }\nRobot robo = new Robot();",

    "class Student { String name; }\n" +
    "Student alex = new Student();\nalex.name = \"Alex\";",

    "alex.wave();",

    "robo.energy = 100;",

    "class Robot {\n  String name;\n  int energy;\n" +
    "  Robot(String name, int energy) {\n" +
    "    this.name = name;\n    this.energy = energy;\n  }\n}\n" +
    "Robot robo = new Robot(\"Robo\", 100);",

    "alex.repair(robo);",

    "void charge() {\n  this.energy = 100;\n}",

    "robo.charge();\nrobo.activate();",

    "alex.repair(robo);\nrobo.unlock(door);\ndoor.open();",

    "Student alex = new Student(\"Alex\");\n" +
    "Robot robo = new Robot(\"Robo\", 100);\n" +
    "alex.repair(robo);\nrobo.activate();\n" +
    "robo.unlock(door);\ndoor.open();"
];

/* Mirrors validateCode() in classroomrescue.html */
function validateRescue(levelNumber, code) {

    var level = crLevels[levelNumber - 1];

    var clean = code
        .replace(/\/\/.*$/gm, "")
        .replace(/\s+/g, " ")
        .trim();

    if (levelNumber === 8) {
        var charge = clean.search(/robo\s*\.\s*charge\s*\(\s*\)/i);
        var activate = clean.search(/robo\s*\.\s*activate\s*\(\s*\)/i);
        return charge !== -1 && activate !== -1 && charge < activate;
    }

    if (level.checks) {
        return level.checks.every(function (re) { return re.test(clean); });
    }

    return false;
}

console.log("\nClassroom Rescue - " + crLevels.length + " levels");

crLevels.forEach(function (level, index) {

    var n = index + 1;

    ok("CR level " + n + " accepts correct Java",
        validateRescue(n, CR_SOLUTIONS[index]) === true);

    ok("CR level " + n + " rejects the starter skeleton",
        validateRescue(n, level.starter) === false);

    ok("CR level " + n + " has tiered hints",
        Array.isArray(level.hints) && level.hints.length >= 2);

    ok("CR level " + n + " reference is generic",
        !level.reference || level.reference.indexOf("robo") === -1);
});

ok("CR level 8 rejects the wrong order",
    validateRescue(8, "robo.activate();\nrobo.charge();") === false);


/* ---------------------------------------------------
   3. LOOP LABYRINTH - LOOPS
--------------------------------------------------- */

var challenges = new Function(
    extractArray(read("looplabyrinth.html"), "const challenges = [")
        .replace(/^\[/, "return [")
)();

var LL_SOLUTIONS = [
    "for (int i = 0; i < 3; i++) { System.out.println(\"HACKO\"); }",

    "int energy = 1;\nwhile (energy <= 4) {\n" +
    "  System.out.println(energy);\n  energy++;\n}",

    "for (int tile = 1; tile <= 5; tile++) { buildBridge(tile); }",

    "int firewall = 4;\nwhile (firewall > 0) { firewall--; }",

    "for (int n = 2; n <= 10; n += 2) { System.out.println(n); }",

    "int sector = 1;\nwhile (sector <= 6) {\n  scan(sector);\n  sector++;\n}",

    "for (int row = 0; row < 3; row++) {\n" +
    "  for (int col = 0; col < 3; col++) {\n    check(row, col);\n  }\n}",

    "int timer = 8;\nwhile (timer >= 0) {\n" +
    "  System.out.println(timer);\n  timer -= 2;\n}",

    "String key = \"\";\nfor (int i = 0; i < 3; i++) { key += \"LOOP\"; }",

    "int keys = 0;\nfor (int i = 0; i < 5; i++) { keys++; }\n" +
    "while (keys > 0) { keys--; }"
];

/* Mirrors normalize() + submitAnswer() in looplabyrinth.html */
function normalize(value) {
    return value.toLowerCase().replace(/\s+/g, "").replace(/;/g, "");
}

function validateLoop(index, answer) {

    var challenge = challenges[index];
    var normalized = normalize(answer);

    var correct = answer.trim().length > 12 &&
        challenge.tokens.every(function (token) {
            return normalized.indexOf(normalize(token)) !== -1;
        });

    var forCount = (answer.match(/\bfor\s*\(/gi) || []).length;
    var whileCount = (answer.match(/\bwhile\s*\(/gi) || []).length;

    if (challenge.minFor && forCount < challenge.minFor) {
        correct = false;
    }

    if (challenge.minWhile && whileCount < challenge.minWhile) {
        correct = false;
    }

    return correct;
}

console.log("\nLoop Labyrinth - " + challenges.length + " challenges");

challenges.forEach(function (challenge, index) {

    var n = index + 1;

    ok("LL level " + n + " accepts correct Java",
        validateLoop(index, LL_SOLUTIONS[index]) === true);

    ok("LL level " + n + " rejects the starter skeleton",
        validateLoop(index, challenge.starter) === false);

    ok("LL level " + n + " has tiered hints",
        Array.isArray(challenge.hints) && challenge.hints.length >= 2);

    ok("LL level " + n + " teaches Java, not JavaScript",
        LL_SOLUTIONS[index].indexOf("console.log") === -1 &&
        !/\blet\s/.test(LL_SOLUTIONS[index]));
});


/* ---------------------------------------------------
   4. LOOP BOSS

   Loop Boss no longer regex-matches the player's source.
   It runs their Java and diffs the output, so its levels
   are verified by tools/check-shields.js instead.
--------------------------------------------------- */


console.log("\n" + passed + " passed, " + failed + " failed");

if (failed) {
    process.exit(1);
}
