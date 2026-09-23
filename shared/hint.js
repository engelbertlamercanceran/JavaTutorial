/* =========================================================
   HACKO - shared/hint.js
   Tiered hints, with a guard that refuses to show a hint
   containing its own answer.

   Three games used to hand the answer straight to the
   player: the escape room clue said "The door code is 42"
   when 42 WAS the answer, and Loop Labyrinth typed the
   finished code into the answer box. leaks() exists so that
   class of bug cannot come back unnoticed - a leaking hint
   is blocked at runtime and reported by tools/audit-hints.js.

       var hint = HackoHint.forPuzzle({
           id: "m4-l3",
           answer: "for (int i = 0; i < 5; i++)",
           tiers: [nudge, structure, workedExample]
       });

       hint.next();   // -> { text, tier, last }
========================================================= */

(function (global) {
    "use strict";

    /* A worked example may legitimately share short keywords
       with the answer ("for", "int"). Only runs of at least
       this many characters count as a leak. */
    var MIN_LEAK_RUN = 8;

    var TIER_NAMES = ["Nudge", "Structure", "Worked example"];


    /* ---------------------------------------------------
       LEAK DETECTION
    --------------------------------------------------- */

    function normalise(text) {
        return String(text)
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    }

    /* Standalone numbers in the answer - "42" in the answer
       must not appear as "42" in the hint. */
    function numbersIn(text) {
        return String(text).match(/-?\d+(\.\d+)?/g) || [];
    }

    /* Quoted literals in the answer - "admin", 'X'. */
    function quotedIn(text) {
        var out = [];
        var re = /["']([^"']{1,60})["']/g;
        var match;

        while ((match = re.exec(String(text))) !== null) {
            if (match[1].trim()) {
                out.push(match[1]);
            }
        }

        return out;
    }

    function containsToken(haystack, token) {
        var escaped = String(token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp("(^|[^\\w])" + escaped + "($|[^\\w])", "i")
            .test(haystack);
    }

    /* Returns a reason string when hintText gives away
       answer, or null when the hint is safe. */
    function leaks(hintText, answer) {

        if (!hintText || answer === undefined || answer === null) {
            return null;
        }

        var hint = normalise(hintText);
        var ans = normalise(answer);

        if (!ans) {
            return null;
        }

        /* The whole answer, present verbatim. Single-word
           answers are matched on word boundaries so a
           one-character answer like "X" is still caught;
           multi-word answers are matched as a substring. */
        if (ans.indexOf(" ") === -1) {

            if (containsToken(hint, ans)) {
                return "hint contains the whole answer (" + answer + ")";
            }

        } else if (hint.indexOf(ans) !== -1) {
            return "hint contains the whole answer (" + answer + ")";
        }

        /* a literal value from the answer */
        var literals = numbersIn(answer).concat(quotedIn(answer));

        for (var i = 0; i < literals.length; i++) {
            if (containsToken(hint, literals[i])) {
                return "hint gives away the literal \"" + literals[i] + "\"";
            }
        }

        /* a long shared run, which means the hint is really
           just the answer with cosmetic edits */
        if (ans.length >= MIN_LEAK_RUN) {

            for (var start = 0; start + MIN_LEAK_RUN <= ans.length; start++) {

                var run = ans.slice(start, start + MIN_LEAK_RUN);

                if (run.indexOf(" ") === -1 && hint.indexOf(run) !== -1) {
                    return "hint repeats \"" + run + "\" from the answer";
                }
            }
        }

        return null;
    }


    /* ---------------------------------------------------
       PUZZLE HINTS
    --------------------------------------------------- */

    function forPuzzle(config) {

        var tiers = (config && config.tiers) || [];
        var answer = config && config.answer;
        var id = (config && config.id) || "puzzle";

        var used = 0;

        function textAt(index) {

            var text = tiers[index];

            if (!text) {
                return null;
            }

            var problem = leaks(text, answer);

            if (problem) {

                if (global.console && global.console.warn) {
                    global.console.warn(
                        "[HackoHint] blocked hint for " + id + ": " + problem
                    );
                }

                return "That hint was withheld because it gave away the " +
                       "answer. Try working from the clue you already have.";
            }

            return text;
        }

        return {

            id: id,

            /* Reveals the next tier. */
            next: function () {

                if (used >= tiers.length) {
                    return {
                        text: textAt(tiers.length - 1),
                        tier: tiers.length - 1,
                        name: TIER_NAMES[tiers.length - 1] || "Hint",
                        last: true
                    };
                }

                var index = used;
                used += 1;

                return {
                    text: textAt(index),
                    tier: index,
                    name: TIER_NAMES[index] || "Hint",
                    last: used >= tiers.length
                };
            },

            peek: function (index) {
                return textAt(index);
            },

            get tier() {
                return used;
            },

            get exhausted() {
                return used >= tiers.length;
            },

            reset: function () {
                used = 0;
            }
        };
    }


    /* ---------------------------------------------------
       AUDIT
       Used by tools/audit-hints.js to fail the build if any
       authored hint gives away its answer.
    --------------------------------------------------- */

    function audit(puzzles) {

        var problems = [];

        (puzzles || []).forEach(function (p) {

            (p.tiers || []).forEach(function (text, index) {

                var problem = leaks(text, p.answer);

                if (problem) {
                    problems.push({
                        id: p.id,
                        tier: index,
                        reason: problem,
                        text: text
                    });
                }
            });
        });

        return problems;
    }


    global.HackoHint = {
        forPuzzle: forPuzzle,
        leaks: leaks,
        audit: audit,
        MIN_LEAK_RUN: MIN_LEAK_RUN,
        TIER_NAMES: TIER_NAMES
    };

}(window));
