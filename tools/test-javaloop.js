/* =========================================================
   HACKO - tools/test-javaloop.js

   Tests the little Java interpreter that the loop missions
   run the player's code through.

       node tools/test-javaloop.js

   The point of the interpreter is that ANY code producing
   the right output passes. The old regex matching rejected
   correct answers written in an unexpected shape, so the
   "same output, different code" cases below matter most.
========================================================= */

"use strict";

require("../shared/javaloop.js");

var J = globalThis.HackoJava;

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

function prints(name, source, expected) {

    var result = J.run(source);

    if (result.error) {
        ok(name, false, "error: " + result.error);
        return;
    }

    ok(name, result.output === expected,
        "got " + JSON.stringify(result.output) +
        "\n        want " + JSON.stringify(expected));
}

function errors(name, source, fragment) {

    var result = J.run(source);

    ok(name, result.error !== null &&
        (!fragment || result.error.indexOf(fragment) !== -1),
        "error was: " + result.error);
}


console.log("basics");

prints("print", 'System.out.print("hi");', "hi");
prints("println", 'System.out.println("hi");', "hi\n");
prints("empty println", 'System.out.println();', "\n");
prints("int variable", 'int a = 7; System.out.println(a);', "7\n");
prints("arithmetic", 'System.out.println(2 + 3 * 4);', "14\n");
prints("integer division", 'System.out.println(7 / 2);', "3\n");
prints("modulo", 'System.out.println(7 % 2);', "1\n");
prints("string concat", 'System.out.println("a" + 1 + "b");', "a1b\n");
prints("boolean printing", 'boolean b = true; System.out.println(b);', "true\n");
prints("String var", 'String s = "hey"; System.out.println(s);', "hey\n");
prints("compound assign", 'int a = 1; a += 4; System.out.println(a);', "5\n");
prints("string building",
    'String k = ""; k += "LO"; k += "OP"; System.out.println(k);', "LOOP\n");


console.log("\nloops");

prints("count 1..5",
    'for (int i = 1; i <= 5; i++) { System.out.println(i); }',
    "1\n2\n3\n4\n5\n");

prints("count down",
    'for (int i = 3; i >= 1; i--) { System.out.println(i); }',
    "3\n2\n1\n");

prints("step by two",
    'for (int n = 2; n <= 6; n += 2) { System.out.print(n); }',
    "246");

prints("while loop",
    'int i = 1; while (i <= 3) { System.out.print(i); i++; }',
    "123");

prints("nested 3x3",
    'for (int r = 1; r <= 3; r++) {' +
    '  for (int c = 1; c <= 3; c++) { System.out.print("*"); }' +
    '  System.out.println();' +
    '}',
    "***\n***\n***\n");

prints("growing triangle",
    'for (int r = 1; r <= 4; r++) {' +
    '  for (int c = 1; c <= r; c++) { System.out.print("*"); }' +
    '  System.out.println();' +
    '}',
    "*\n**\n***\n****\n");

prints("if inside loop",
    'for (int i = 1; i <= 6; i++) {' +
    '  if (i % 2 == 0) { System.out.print(i); }' +
    '}',
    "246");

prints("else if chain",
    'int n = 4;' +
    'if (n >= 8) { System.out.print("A"); }' +
    'else if (n >= 3) { System.out.print("B"); }' +
    'else { System.out.print("C"); }',
    "B");

prints("nested conditionals",
    'boolean a = true; boolean b = false;' +
    'if (a) { if (b) { System.out.print("X"); } else { System.out.print("Y"); } }',
    "Y");

prints("multiplication row",
    'for (int c = 1; c <= 4; c++) { System.out.print((2 * c) + " "); }',
    "2 4 6 8 ");

prints("checkerboard",
    'for (int r = 1; r <= 2; r++) {' +
    '  for (int c = 1; c <= 2; c++) {' +
    '    if ((r + c) % 2 == 0) { System.out.print("*"); }' +
    '    else { System.out.print("."); }' +
    '  }' +
    '  System.out.println();' +
    '}',
    "*.\n.*\n");


console.log("\nsame output, different code - all must pass");

var TARGET = "1\n2\n3\n4\n5\n";

prints("classic for",
    'for (int i = 1; i <= 5; i++) { System.out.println(i); }', TARGET);

prints("zero-based with offset",
    'for (int i = 0; i < 5; i++) { System.out.println(i + 1); }', TARGET);

prints("while instead of for",
    'int i = 1; while (i <= 5) { System.out.println(i); i++; }', TARGET);

prints("different variable name",
    'for (int counter = 1; counter < 6; counter++) ' +
    '{ System.out.println(counter); }', TARGET);

prints("no braces",
    'for (int i = 1; i <= 5; i++) System.out.println(i);', TARGET);


console.log("\nwrapped in a class");

prints("full class and main",
    'public class Main {\n' +
    '  public static void main(String[] args) {\n' +
    '    System.out.println("ok");\n' +
    '  }\n' +
    '}',
    "ok\n");


console.log("\nerrors are explained, never thrown");

errors("undeclared variable", 'System.out.println(nope);', "declared");
/* A runaway loop is caught either by the step cap or by the
   output cap, depending on whether it prints. Both are fine. */
errors("infinite loop that prints is stopped",
    'for (int i = 1; i <= 5; i--) { System.out.print(i); }');
errors("infinite loop that prints nothing is stopped",
    'for (int i = 1; i <= 5; i--) { int x = 1; }', "forever");
errors("divide by zero", 'System.out.println(1 / 0);', "zero");
errors("missing brace", 'for (int i = 0; i < 3; i++) { System.out.print(i);',
    "closing");
errors("empty source", '   ', "no code");

ok("a syntax error never throws", (function () {
    try {
        J.run("this is not java at all ((((");
        return true;
    } catch (e) {
        return false;
    }
}()));


console.log("\noutput comparison");

(function () {

    var same = J.compare("*\n**\n", "*\n**\n");
    ok("identical output matches", same.match === true);

    var diff = J.compare("*\n**\n****\n", "*\n**\n***\n");
    ok("reports the first differing line", diff.match === false && diff.line === 3,
        "line was " + diff.line);
    ok("reports what was got", diff.got === "****");
    ok("reports what was wanted", diff.want === "***");

    var trailing = J.compare("ab\n\n\n", "ab");
    ok("trailing blank lines ignored", trailing.match === true);

    var spaces = J.compare("ab   \n", "ab\n");
    ok("trailing spaces ignored", spaces.match === true);

    var short = J.compare("*\n", "*\n**\n");
    ok("missing lines are reported", short.match === false &&
        short.got === "(nothing)");
}());


console.log("\n" + passed + " passed, " + failed + " failed");

if (failed) {
    process.exit(1);
}
