/* =========================================================
   HACKO - shared/javaloop.js

   Runs the subset of Java the loop missions teach, and
   returns what it printed.

       HackoJava.run(source)
       -> { output: "1\n2\n3\n", error: null }

   Why this exists: the loop missions used to REGEX-MATCH the
   player's source. Writing correct code in an unexpected
   shape was rejected, and the only feedback was "the boss
   detected the wrong pattern". Running the code and diffing
   the output means any working answer passes, and a wrong
   one can be shown side by side with the target.

   Supported: int/String/boolean/char/double declarations,
   assignment and compound assignment, ++ and --, for loops
   (nested to any depth), if / else if / else, while,
   System.out.print and println, and the usual arithmetic,
   comparison and logical operators.

   Deliberately NOT supported: classes, methods, arrays,
   imports, Scanner. Those belong to other missions, and a
   small honest interpreter beats a large unreliable one.
========================================================= */

(function (global) {
    "use strict";

    /* An infinite loop in a student's code must not hang the
       page, so every statement executed counts against this. */
    var MAX_STEPS = 400000;
    var MAX_OUTPUT = 20000;


    /* ---------------------------------------------------
       TOKENISER
    --------------------------------------------------- */

    var PUNCT = [
        "&&", "||", "==", "!=", "<=", ">=", "++", "--",
        "+=", "-=", "*=", "/=", "%=",
        "{", "}", "(", ")", ";", ",", "=", "<", ">",
        "+", "-", "*", "/", "%", "!", "."
    ];

    function tokenise(src) {

        var tokens = [];
        var i = 0;

        while (i < src.length) {

            var ch = src[i];

            /* whitespace */
            if (/\s/.test(ch)) {
                i += 1;
                continue;
            }

            /* comments */
            if (ch === "/" && src[i + 1] === "/") {
                while (i < src.length && src[i] !== "\n") {
                    i += 1;
                }
                continue;
            }

            if (ch === "/" && src[i + 1] === "*") {
                i += 2;
                while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
                    i += 1;
                }
                i += 2;
                continue;
            }

            /* string literal */
            if (ch === '"' || ch === "'") {

                var quote = ch;
                var value = "";
                i += 1;

                while (i < src.length && src[i] !== quote) {

                    if (src[i] === "\\") {

                        var next = src[i + 1];

                        value += next === "n" ? "\n"
                            : next === "t" ? "\t"
                            : next === "\\" ? "\\"
                            : next;

                        i += 2;
                        continue;
                    }

                    value += src[i];
                    i += 1;
                }

                i += 1;
                tokens.push({ type: "string", value: value });
                continue;
            }

            /* number */
            if (/[0-9]/.test(ch)) {

                var num = "";

                while (i < src.length && /[0-9.]/.test(src[i])) {
                    num += src[i];
                    i += 1;
                }

                tokens.push({ type: "number", value: Number(num) });
                continue;
            }

            /* identifier or keyword */
            if (/[A-Za-z_$]/.test(ch)) {

                var word = "";

                while (i < src.length && /[A-Za-z0-9_$]/.test(src[i])) {
                    word += src[i];
                    i += 1;
                }

                tokens.push({ type: "word", value: word });
                continue;
            }

            /* punctuation, longest match first */
            var matched = null;

            for (var p = 0; p < PUNCT.length; p++) {
                if (src.startsWith(PUNCT[p], i)) {
                    matched = PUNCT[p];
                    break;
                }
            }

            if (!matched) {
                throw new Error("Unexpected character: " + ch);
            }

            tokens.push({ type: "punct", value: matched });
            i += matched.length;
        }

        tokens.push({ type: "eof", value: null });

        return tokens;
    }


    /* ---------------------------------------------------
       PARSER
    --------------------------------------------------- */

    var TYPES = ["int", "String", "boolean", "char", "double", "long", "float"];

    function parse(tokens) {

        var pos = 0;

        function peek(offset) {
            return tokens[pos + (offset || 0)];
        }

        function at(value) {
            var t = peek();
            return t.value === value;
        }

        function eat(value) {

            var t = peek();

            if (value !== undefined && t.value !== value) {
                throw new Error(
                    "Expected '" + value + "' but found '" +
                    (t.value === null ? "end of code" : t.value) + "'"
                );
            }

            pos += 1;
            return t;
        }

        function parseBlock() {

            if (at("{")) {

                eat("{");
                var body = [];

                while (!at("}")) {

                    if (peek().type === "eof") {
                        throw new Error("Missing a closing }");
                    }

                    body.push(parseStatement());
                }

                eat("}");
                return { kind: "block", body: body };
            }

            return { kind: "block", body: [parseStatement()] };
        }

        function parseStatement() {

            var t = peek();

            /* a stray semicolon is harmless */
            if (t.value === ";") {
                eat(";");
                return { kind: "empty" };
            }

            if (t.value === "{") {
                return parseBlock();
            }

            if (t.value === "for") {
                return parseFor();
            }

            if (t.value === "while") {
                return parseWhile();
            }

            if (t.value === "if") {
                return parseIf();
            }

            /* declaration: type name = expr ; */
            if (t.type === "word" &&
                TYPES.indexOf(t.value) !== -1 &&
                peek(1).type === "word") {

                return parseDeclaration(true);
            }

            var expr = parseSimpleStatement();
            eat(";");
            return expr;
        }

        function parseDeclaration(wantSemicolon) {

            eat();                       /* the type */
            var name = eat().value;
            var init = null;

            if (at("=")) {
                eat("=");
                init = parseExpression();
            }

            if (wantSemicolon) {
                eat(";");
            }

            return { kind: "declare", name: name, init: init };
        }

        /* assignment, ++/--, or a print call */
        function parseSimpleStatement() {

            var t = peek();

            /* System.out.print / println */
            if (t.value === "System") {

                eat("System");
                eat(".");
                eat("out");
                eat(".");

                var method = eat().value;

                if (method !== "print" && method !== "println") {
                    throw new Error(
                        "Only System.out.print and System.out.println " +
                        "are available here"
                    );
                }

                eat("(");

                var arg = at(")") ? null : parseExpression();

                eat(")");

                return { kind: "print", newline: method === "println", arg: arg };
            }

            if (t.type === "word") {

                var name = eat().value;

                if (at("++") || at("--")) {
                    var op = eat().value;
                    return { kind: "step", name: name, by: op === "++" ? 1 : -1 };
                }

                if (at("=")) {
                    eat("=");
                    return { kind: "assign", name: name, value: parseExpression() };
                }

                var compound = ["+=", "-=", "*=", "/=", "%="];

                for (var c = 0; c < compound.length; c++) {
                    if (at(compound[c])) {
                        eat(compound[c]);
                        return {
                            kind: "assign",
                            name: name,
                            op: compound[c][0],
                            value: parseExpression()
                        };
                    }
                }

                throw new Error("Do not know what to do with '" + name + "'");
            }

            throw new Error(
                "Unexpected '" + (t.value === null ? "end of code" : t.value) + "'"
            );
        }

        function parseFor() {

            eat("for");
            eat("(");

            var init = null;

            if (!at(";")) {

                var t = peek();

                init = (t.type === "word" && TYPES.indexOf(t.value) !== -1)
                    ? parseDeclaration(false)
                    : parseSimpleStatement();
            }

            eat(";");

            var test = at(";") ? null : parseExpression();
            eat(";");

            var update = at(")") ? null : parseSimpleStatement();
            eat(")");

            return {
                kind: "for",
                init: init,
                test: test,
                update: update,
                body: parseBlock()
            };
        }

        function parseWhile() {

            eat("while");
            eat("(");
            var test = parseExpression();
            eat(")");

            return { kind: "while", test: test, body: parseBlock() };
        }

        function parseIf() {

            eat("if");
            eat("(");
            var test = parseExpression();
            eat(")");

            var then = parseBlock();
            var otherwise = null;

            if (at("else")) {
                eat("else");
                otherwise = at("if") ? parseIf() : parseBlock();
            }

            return {
                kind: "if",
                test: test,
                then: then,
                otherwise: otherwise
            };
        }

        /* expressions, loosest binding first */

        function parseExpression() {
            return parseOr();
        }

        function binary(next, ops) {
            return function () {

                var left = next();

                for (;;) {

                    var matched = null;

                    for (var i = 0; i < ops.length; i++) {
                        if (at(ops[i])) {
                            matched = ops[i];
                            break;
                        }
                    }

                    if (!matched) {
                        return left;
                    }

                    eat(matched);
                    left = { kind: "binary", op: matched, left: left, right: next() };
                }
            };
        }

        function parseUnary() {

            if (at("!")) {
                eat("!");
                return { kind: "not", value: parseUnary() };
            }

            if (at("-")) {
                eat("-");
                return { kind: "negate", value: parseUnary() };
            }

            return parsePrimary();
        }

        var parseMul = binary(parseUnary, ["*", "/", "%"]);
        var parseAdd = binary(parseMul, ["+", "-"]);
        var parseRel = binary(parseAdd, ["<=", ">=", "<", ">"]);
        var parseEq = binary(parseRel, ["==", "!="]);
        var parseAnd = binary(parseEq, ["&&"]);
        var parseOr = binary(parseAnd, ["||"]);

        function parsePrimary() {

            var t = peek();

            if (t.value === "(") {
                eat("(");
                var inner = parseExpression();
                eat(")");
                return inner;
            }

            if (t.type === "number") {
                eat();
                return { kind: "literal", value: t.value };
            }

            if (t.type === "string") {
                eat();
                return { kind: "literal", value: t.value };
            }

            if (t.type === "word") {

                if (t.value === "true" || t.value === "false") {
                    eat();
                    return { kind: "literal", value: t.value === "true" };
                }

                eat();

                /* post-increment used as a value */
                if (at("++") || at("--")) {
                    var op = eat().value;
                    return {
                        kind: "stepValue",
                        name: t.value,
                        by: op === "++" ? 1 : -1
                    };
                }

                return { kind: "name", name: t.value };
            }

            throw new Error(
                "Unexpected '" + (t.value === null ? "end of code" : t.value) + "'"
            );
        }

        var program = [];

        while (peek().type !== "eof") {
            program.push(parseStatement());
        }

        return program;
    }


    /* ---------------------------------------------------
       EVALUATOR
    --------------------------------------------------- */

    function execute(program) {

        var out = [];
        var vars = Object.create(null);
        var steps = 0;

        function tick() {

            steps += 1;

            if (steps > MAX_STEPS) {
                throw new Error(
                    "This ran forever. Check that the loop counter " +
                    "actually moves towards its stopping point."
                );
            }
        }

        function get(name) {

            if (!(name in vars)) {
                throw new Error(
                    "'" + name + "' has not been declared yet"
                );
            }

            return vars[name];
        }

        function truthy(value) {
            return value === true || (value !== false && !!value);
        }

        function evaluate(node) {

            switch (node.kind) {

            case "literal":
                return node.value;

            case "name":
                return get(node.name);

            case "not":
                return !truthy(evaluate(node.value));

            case "negate":
                return -evaluate(node.value);

            case "stepValue": {
                var before = get(node.name);
                vars[node.name] = before + node.by;
                return before;
            }

            case "binary": {

                var a = evaluate(node.left);
                var b = evaluate(node.right);

                switch (node.op) {
                case "+":
                    return (typeof a === "string" || typeof b === "string")
                        ? String(stringify(a)) + String(stringify(b))
                        : a + b;
                case "-": return a - b;
                case "*": return a * b;
                case "/":
                    if (b === 0) {
                        throw new Error("Cannot divide by zero");
                    }
                    return (Number.isInteger(a) && Number.isInteger(b))
                        ? Math.trunc(a / b)
                        : a / b;
                case "%":
                    if (b === 0) {
                        throw new Error("Cannot divide by zero");
                    }
                    return a % b;
                case "<": return a < b;
                case ">": return a > b;
                case "<=": return a <= b;
                case ">=": return a >= b;
                case "==": return a === b;
                case "!=": return a !== b;
                case "&&": return truthy(a) && truthy(b);
                case "||": return truthy(a) || truthy(b);
                }

                throw new Error("Unknown operator " + node.op);
            }
            }

            throw new Error("Cannot evaluate " + node.kind);
        }

        function stringify(value) {

            if (value === true) { return "true"; }
            if (value === false) { return "false"; }
            if (value === null || value === undefined) { return "null"; }

            return String(value);
        }

        function emit(text) {

            out.push(text);

            if (out.join("").length > MAX_OUTPUT) {
                throw new Error(
                    "That printed far more than the pattern needs - " +
                    "check the loop bounds."
                );
            }
        }

        function run(node) {

            tick();

            switch (node.kind) {

            case "empty":
                return;

            case "block":
                node.body.forEach(run);
                return;

            case "declare":
                vars[node.name] = node.init === null
                    ? 0
                    : evaluate(node.init);
                return;

            case "assign": {

                if (node.op) {

                    var current = get(node.name);
                    var operand = evaluate(node.value);

                    vars[node.name] =
                        node.op === "+"
                            ? ((typeof current === "string" ||
                                typeof operand === "string")
                                ? stringify(current) + stringify(operand)
                                : current + operand)
                        : node.op === "-" ? current - operand
                        : node.op === "*" ? current * operand
                        : node.op === "/" ? Math.trunc(current / operand)
                        : current % operand;

                    return;
                }

                vars[node.name] = evaluate(node.value);
                return;
            }

            case "step":
                vars[node.name] = get(node.name) + node.by;
                return;

            case "print":
                emit(
                    (node.arg === null ? "" : stringify(evaluate(node.arg))) +
                    (node.newline ? "\n" : "")
                );
                return;

            case "for": {

                if (node.init) {
                    run(node.init);
                }

                while (node.test === null || truthy(evaluate(node.test))) {

                    tick();
                    run(node.body);

                    if (node.update) {
                        run(node.update);
                    }
                }

                return;
            }

            case "while": {

                while (truthy(evaluate(node.test))) {
                    tick();
                    run(node.body);
                }

                return;
            }

            case "if": {

                if (truthy(evaluate(node.test))) {
                    run(node.then);
                } else if (node.otherwise) {
                    run(node.otherwise);
                }

                return;
            }
            }

            throw new Error("Cannot run " + node.kind);
        }

        program.forEach(run);

        return out.join("");
    }


    /* ---------------------------------------------------
       PUBLIC
    --------------------------------------------------- */

    /* Students paste whole classes sometimes. Unwrap them so
       the body is what gets run. */
    function unwrap(source) {

        var text = String(source || "");

        var classMatch = /class\s+\w+\s*\{([\s\S]*)\}\s*$/.exec(text);

        if (classMatch) {
            text = classMatch[1];
        }

        var mainMatch =
            /(?:public\s+)?static\s+void\s+main\s*\([^)]*\)\s*\{([\s\S]*)\}\s*$/
                .exec(text);

        if (mainMatch) {
            text = mainMatch[1];
        }

        return text;
    }

    function run(source) {

        try {

            var body = unwrap(source);

            if (!body.trim()) {
                return { output: "", error: "There is no code to run yet." };
            }

            return { output: execute(parse(tokenise(body))), error: null };

        } catch (e) {
            return { output: "", error: e.message };
        }
    }

    /* Compares two blocks of output, ignoring trailing blank
       lines and trailing spaces, and reports the first line
       that differs. */
    function compare(actual, expected) {

        function clean(text) {
            return String(text)
                .replace(/[ \t]+$/gm, "")
                .replace(/\s+$/, "")
                .split("\n");
        }

        var a = clean(actual);
        var b = clean(expected);

        for (var i = 0; i < Math.max(a.length, b.length); i++) {

            if ((a[i] || "") !== (b[i] || "")) {
                return {
                    match: false,
                    line: i + 1,
                    got: a[i] === undefined ? "(nothing)" : a[i],
                    want: b[i] === undefined ? "(nothing)" : b[i]
                };
            }
        }

        return { match: true };
    }

    global.HackoJava = {
        run: run,
        compare: compare,
        tokenise: tokenise,
        parse: parse
    };

}(typeof window !== "undefined" ? window : globalThis));
