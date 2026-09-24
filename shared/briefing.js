/* =========================================================
   HACKO - shared/briefing.js
   The mission briefing every game opens with.

       <script src="shared/briefing.js" data-mission="4"></script>

   The client asked for a loading screen with a guide for the
   levels. These games load instantly, so rather than a fake
   delay this is a briefing the player reads at their own pace:
   the goal, how to win, the controls, the lives rule, and a
   guide for the level they are about to play. START closes it
   (and, being a click, also lets the browser start sound).
   A "? HOW TO PLAY" button reopens it at any time.

   While it is open the game is frozen - animation frames and
   intervals are held - so nothing moves and no timer runs
   while the player is reading. Every game's loop already caps
   its time step, so resuming does not make anything jump.

   Load it in <head>, after storage.js and before the game's
   own script, so it can hold the game's loops from the start.
========================================================= */

(function (global) {
    "use strict";

    var ownScript = global.document && global.document.currentScript;
    var MISSION = ownScript ? Number(ownScript.getAttribute("data-mission")) : 0;

    var LIVES_RULE = "You have 3 lives. Lose all 3 and you go back one level - " +
        "so a mistake costs a little, never the whole mission.";

    var BRIEFS = {

        1: {
            title: "The Escape Room",
            topic: "Data types",
            goal: "Hacko is locked in a vault. Every door code is made of " +
                "variables - collect the right data types and wire them into " +
                "the terminal to get out.",
            steps: [
                "Run and jump through the vault, collecting every data chip (int, String, boolean...).",
                "Stand next to a bookshelf, desk or switch and press E to read its clue.",
                "Reach the terminal at the end and drag each chip into the variable it matches.",
                "Dodge lasers and security bots - they drain your health."
            ],
            controls: [
                ["← →  /  A D", "Run"],
                ["SPACE", "Jump (press twice to double jump)"],
                ["E", "Read a clue"]
            ],
            levels: [
                "VAULT 01 - Three types: int is a whole number, String is text in quotes, boolean is true or false.",
                "VAULT 02 - Adds double: a number with a decimal point, like 1.85.",
                "VAULT 03 - Adds char: one single character in single quotes, like 'X'.",
                "VAULT 04 - All five types in one vault. Read every clue before you reach the terminal.",
                "VAULT 05 - Same five types, more hazards. Take it slowly and use the checkpoints.",
                "VAULT 06 - The switch clue changes from vault to vault. Read it - do not guess true or false.",
                "VAULT 07 - A sixth chip appears: a second String, for the backup word.",
                "VAULT 08 - Two Strings now. Match each one to the right variable name.",
                "VAULT 09 - Higher platforms. Double jump to reach the chips up top.",
                "VAULT 10 - Everything at once. Collect every chip, read every clue, then fill the terminal."
            ]
        },

        2: {
            title: "The Secret Message",
            topic: "Input and output",
            goal: "A secret message is locked behind a digital door. Collect " +
                "the data clues in the maze, then write the Java program that " +
                "opens the door.",
            steps: [
                "Walk the maze and collect every data clue - press E to read each one.",
                "Avoid the security bots. Touching one costs health.",
                "When every clue is found, go to the door and press E to open the terminal.",
                "Write the program, run it, then walk through the open door to the exit."
            ],
            controls: [
                ["W A S D  /  ARROWS", "Move"],
                ["E", "Read a clue / use the door"]
            ],
            levels: [
                "FIRST OUTPUT - System.out.println(...) prints one line.",
                "AGENT IDENTITY - Scanner's nextLine() reads a line of text.",
                "ACCESS NUMBER - nextInt() reads a whole number.",
                "ACCESS STATUS - nextBoolean() reads true or false.",
                "SECRET SYMBOL - next().charAt(0) takes a single character.",
                "MULTIPLE INPUTS - read several values, one after another, in order.",
                "SCANNER METHODS - pick the right method for each type of input.",
                "INPUT VALIDATION - check a value is sensible before you use it.",
                "MESSAGE ASSEMBLY - + joins Strings together into one message.",
                "THE SECRET MESSAGE - every skill at once: read, check, build and print."
            ]
        },

        3: {
            title: "Conditional Challenge",
            topic: "if / else conditions",
            goal: "A bomb is armed somewhere in the maze. Collect the clues " +
                "while dodging the security birds, then defuse the bomb by " +
                "writing the right condition - before the timer runs out.",
            steps: [
                "Move through the maze and collect the clues shown in the objective.",
                "Avoid the security birds. Grab a power core and, for a short time, you can catch them.",
                "With enough clues, reach the bomb chamber and press E.",
                "Write the if statement that defuses it. Watch the timer!"
            ],
            controls: [
                ["W A S D  /  ARROWS", "Move"],
                ["E", "Open the bomb"]
            ],
            levels: [
                "SIMPLE IF - the code inside runs only when the condition is true.",
                "IF OR ELSE - else runs when the condition is false.",
                "EQUALITY - compare with ==. A single = assigns, it does not compare.",
                "BOOLEAN BRANCH - a boolean variable can be the whole condition.",
                "LOGICAL AND - && needs BOTH sides to be true.",
                "LOGICAL OR - || needs just ONE side to be true.",
                "ELSE-IF - the chain stops at the first test that is true.",
                "NESTED IF - an if inside an if: both must pass.",
                "COMPLEX LOGIC - mix &&, || and ! - work out each part separately.",
                "FINAL CONDITIONAL - a complete program. Trace it line by line."
            ]
        },

        4: {
            title: "Loop Labyrinth",
            topic: "for and while loops",
            goal: "Escape the labyrinth. Collect the data cores, open the loop " +
                "gate by writing a loop, and reach the exit alive.",
            steps: [
                "Collect every glowing data core.",
                "Stand beside the loop gate and press E - write the loop it asks for.",
                "Avoid spikes, blades, acid and the patrolling enemies.",
                "With every core collected and the gate open, walk to the exit."
            ],
            controls: [
                ["W A S D  /  ARROWS", "Move one tile"],
                ["E", "Use the loop gate"],
                ["R", "Restart the level"]
            ],
            levels: [
                "Boot Sequence - a for loop that prints HACKO exactly 3 times.",
                "Energy Charge - a while loop printing 1 to 4. Remember to change the counter.",
                "Bridge Builder - a for loop that runs exactly 5 times.",
                "Firewall Drain - a while loop that lowers firewall from 4 to 0.",
                "Even Pulse - even numbers 2 to 10. Try counting up by 2.",
                "Sentinel Scan - keep scanning while sector has not reached 6.",
                "Nested Grid - a loop inside a loop makes a 3 x 3 grid.",
                "Dual Countdown - count timer down from 8 in steps of 2.",
                "Pattern Key - add \"LOOP\" to a String on every pass.",
                "Core Override - a for loop collects 5 keys, then a while loop spends them."
            ]
        },

        5: {
            title: "Array Adventure",
            topic: "Arrays",
            goal: "Hacko's backpack is an array. Collect items, arrange them " +
                "into the exact array the mission asks for, and unlock the portal.",
            steps: [
                "Walk over an item to add it to the end of the array.",
                "Click slots to select them, then SWAP, DISCARD or USE ON PEDESTAL.",
                "When the array matches the mission goal, press CHECK ARRAY.",
                "Avoid red glitches and violet traps, then escape through the portal."
            ],
            controls: [
                ["W A S D  /  ARROWS", "Move"],
                ["CLICK A SLOT", "Select it (index 0 is the first slot)"]
            ],
            levels: [
                "The Empty Backpack - collect any 3 items. Each one lands at the next index.",
                "Red First - the Red Crystal must be at index 0, so collect it first.",
                "Key in the Middle - exactly 3 items with the Golden Key at index 1. Use SWAP.",
                "Feed the Pedestal - select index 2 and use it on the pedestal.",
                "No Junk Allowed - end with exactly 4 items. DISCARD every Junk item.",
                "Perfect Pair - Flame Crystal at index 0 and Ancient Key at index 3.",
                "Search Mission - keep the Master Scroll, then use whatever is at index 1.",
                "Sort by Color - rearrange to Red, Blue, Green, Yellow.",
                "The Triple Lock - 5 slots, with crystals at indexes 0, 2 and 4.",
                "The Living Array - collect all 6, drop the cursed ones, sort low to high, total 42."
            ]
        },

        6: {
            title: "Function Fortress",
            topic: "Functions (methods)",
            goal: "The fortress is sealed by machines that only obey functions. " +
                "Build the right functions, call them in the right order, and " +
                "escape through the portal.",
            steps: [
                "Run to the Code Console to switch it on. Collect Function Stones for energy on the way.",
                "Build a function from blocks, then press SAVE FUNCTION.",
                "Pick a function in the Call Console, fill in its arguments, press ADD CALL, then RUN PROGRAM.",
                "When the program works the lasers switch off - reach the green portal on the far right."
            ],
            controls: [
                ["← →  /  A D", "Move"],
                ["SPACE  /  ↑  /  W", "Jump"]
            ],
            levels: [
                "The Sleeping Door - create openDoor(), then call it once. Saving is not calling!",
                "Three Torches - one function, called exactly three times.",
                "Color Bridge - setColor(color) takes a parameter. Call it with \"blue\".",
                "Moving Platform - two parameters: direction and distance.",
                "Power Meter - getPower() returns a value (50) to whoever called it.",
                "Chain Reaction - one function can call another inside it.",
                "Smart Door - an if inside a function, driven by its parameter.",
                "The Elevator Sequence - three functions, called in exactly this order.",
                "Crystal Calculator - combineCrystals(a, b) returns a + b. Two calls must total 42.",
                "The Core Function - several functions, parameters and a return, all together."
            ]
        },

        7: {
            title: "Debugging Gym",
            topic: "Finding and fixing bugs",
            goal: "Ten bug trainers guard the Debugging Gym. Walk the gym, beat " +
                "each trainer by choosing the patch that fixes their broken Java, " +
                "and defeat Gym Leader Vex.",
            steps: [
                "Walk along the path. The yellow ▼ marks the next trainer.",
                "Step in front of a trainer to start a duel.",
                "Read the buggy code, pick the patch that fixes it, then press RUN PATCH.",
                "A wrong patch costs a life. Win, and you head back into the gym for the next trainer."
            ],
            controls: [
                ["W A S D  /  ARROWS", "Walk"],
                ["E  /  SPACE", "Talk / continue"]
            ],
            levels: [
                "Little Syntax - a statement is missing its closing ); .",
                "Bracket Bunny - every { needs a matching }.",
                "Variable Viper - a variable must be declared with its type first.",
                "Loop Lizard - a loop that never reaches its stop test runs forever.",
                "Condition Cobra - == compares, = assigns.",
                "Null Ninja - you cannot call a method on null.",
                "Array Alligator - indexes start at 0, so the last one is length - 1.",
                "Method Mantis - a call must match the method's parameters.",
                "Multi-Bug Mantle - several bugs at once. Fix every one.",
                "Gym Leader Vex - everything you have learned, in one program."
            ]
        },

        8: {
            title: "Classroom Rescue",
            topic: "Classes and objects",
            goal: "The classroom is locked down. Help Professor Byte by writing " +
                "classes, creating objects and calling their methods until the " +
                "door opens.",
            steps: [
                "Walk around the classroom and press E near people and objects.",
                "Read the task, then write the Java code in the terminal.",
                "Press RUN (or CTRL + ENTER) to test it. A wrong answer costs a life.",
                "Solve all ten tasks to open the classroom door."
            ],
            controls: [
                ["W A S D  /  ARROWS", "Move"],
                ["E", "Interact"],
                ["CTRL + ENTER", "Run your code"]
            ],
            levels: [
                "A class is a blueprint. Write Robot with an int energy field, then create robo.",
                "A String field: make a Student called alex and store his name.",
                "Methods are actions - call wave() on alex with the dot: alex.wave();",
                "Change a field through the object: set robo's energy to 100.",
                "A constructor builds an object with its starting values.",
                "Objects can work together: alex repairs robo.",
                "Find the bug: charge() should really set energy to 100.",
                "Order matters: charge robo before you activate him.",
                "A chain of objects: repair, unlock, then open the door.",
                "The whole rescue in one program, from creating Alex to opening the door."
            ]
        },

        9: {
            title: "Conditional Labyrinth II",
            topic: "Nested and combined conditions",
            goal: "Each room shows a piece of Java with conditions inside it. " +
                "Work out what it prints, then walk into the gate that shows " +
                "that answer.",
            steps: [
                "Read the code on the right and trace it line by line.",
                "Decide exactly what it prints.",
                "Walk into the gate holding that output. A wrong gate is a trap and costs a life.",
                "Clear all ten rooms."
            ],
            controls: [
                ["W A S D  /  ARROWS", "Move"]
            ],
            levels: [
                "An if inside an if - both must be true for the inner line to run.",
                "An else-if chain stops at the FIRST test that is true.",
                "&& needs both sides true - here, three conditions deep.",
                "|| needs only one side to be true.",
                "Nesting can live inside the else branch too.",
                "Three levels of nesting. Take them one at a time.",
                "Parentheses change which comparison goes with which.",
                "! flips a condition. Read it as \"not\".",
                "An else-if chain nested inside an outer if.",
                "Everything at once. Trace carefully, line by line."
            ]
        },

        10: {
            title: "The Loop Master",
            topic: "for, while and do-while",
            goal: "The Loop Master fires slow missiles at Hacko's dome. Write a " +
                "loop that prints one counter-move per missile - every printed " +
                "line launches an interceptor.",
            steps: [
                "Press START. Missiles launch, each tagged with the move that stops it (BLOCK, DODGE...).",
                "They fly slowly - the clock shows how long you have. Write your loop in the editor.",
                "Press FIRE. Line 1 of your output hits missile #1, line 2 hits #2, and so on.",
                "Stop every missile to clear the phase. One that gets through costs a life."
            ],
            controls: [
                ["FIRE  /  CTRL + ENTER", "Run your loop and launch"],
                ["HINT", "Get a clue (it gets more specific each time)"]
            ],
            levels: [
                "The Count - it tells you how many missiles. A known count is a job for a for loop.",
                "Relentless - same shape, 7 missiles. Check < against <=.",
                "The Rage - the number changes every volley. Use while (rage > 0).",
                "The Shield - STRIKE while shield is above 0, and remember to lower it.",
                "The First Blow - rage starts at 0 but it still fires once. Which loop always runs once?",
                "Always One More - do-while: print first, check afterwards.",
                "Two Stances - odd missiles need BLOCK, even ones DODGE. Use i % 2.",
                "The Waves - a loop inside a loop. HOLD after every wave.",
                "The Last Stand - a while loop, then one final BLOCK after it.",
                "The Loop Master - waves that grow: the inner loop runs up to the wave number."
            ]
        }
    };

    var brief = BRIEFS[MISSION];

    if (!brief || !global.document) {
        return;
    }


    /* ---------------------------------------------------
       FREEZING THE GAME WHILE THE BRIEFING IS OPEN
    --------------------------------------------------- */

    var holding = false;
    var queued = [];
    var realRAF = global.requestAnimationFrame.bind(global);
    var realInterval = global.setInterval.bind(global);

    global.requestAnimationFrame = function (fn) {

        if (holding) {
            queued.push(fn);
            return 0;
        }

        return realRAF(fn);
    };

    global.setInterval = function (fn, ms) {

        var extra = Array.prototype.slice.call(arguments, 2);

        if (typeof fn !== "function") {
            return realInterval.apply(global, arguments);
        }

        return realInterval(function () {
            if (!holding) {
                fn.apply(this, extra);
            }
        }, ms);
    };

    function hold() {
        /* let the game draw its first frames so the scene is
           visible behind the briefing, then freeze it */
        realRAF(function () {
            realRAF(function () {
                if (isOpen()) {
                    holding = true;
                }
            });
        });
    }

    function release() {

        holding = false;

        var run = queued;
        queued = [];

        run.forEach(function (fn) {
            realRAF(fn);
        });
    }


    /* ---------------------------------------------------
       WHICH LEVEL IS THE PLAYER ON
    --------------------------------------------------- */

    /* Every game registers an autosave getter that reports its
       current level; borrowing it means the "?" button always
       shows the guide for the level on screen right now. */
    var levelGetter = null;

    if (global.HackoStore && global.HackoStore.bindAutosave) {

        var bind = global.HackoStore.bindAutosave;

        global.HackoStore.bindAutosave = function (getState) {
            levelGetter = getState;
            return bind.apply(this, arguments);
        };
    }

    function currentLevel() {

        try {
            if (levelGetter) {
                var s = levelGetter();
                if (s && typeof s.level === "number") {
                    return s.level;
                }
            }

            if (global.HackoStore && global.HackoStore.isLoggedIn()) {
                return global.HackoStore.getResumeLevel(MISSION) || 0;
            }
        } catch (e) {
            /* a guide is never worth an exception */
        }

        return 0;
    }


    /* ---------------------------------------------------
       THE SCREEN
    --------------------------------------------------- */

    var CSS = [
        "#hk-brief{position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-start;justify-content:center;",
        "padding:16px;background:rgba(3,9,18,.86);backdrop-filter:blur(5px);overflow:auto;",
        "font-family:Rajdhani,'Segoe UI',sans-serif;color:#eefaff}",
        "#hk-brief.hk-hidden{display:none}",
        "#hk-brief .b-card{margin:auto 0;width:min(860px,100%);overflow:auto;border:2px solid #45f3ff;",
        "border-radius:16px;background:linear-gradient(160deg,#0f2743,#07111f 70%);",
        "box-shadow:0 0 40px rgba(69,243,255,.25),0 24px 60px #000;padding:22px 24px}",
        "#hk-brief .b-kicker{font:700 .7rem Orbitron,sans-serif;letter-spacing:.2em;color:#91adc0}",
        "#hk-brief h1{margin:4px 0 6px;font:900 clamp(1.3rem,3.4vw,2rem) Orbitron,sans-serif;color:#45f3ff}",
        "#hk-brief .b-topic{display:inline-block;padding:4px 12px;border:1px solid #ffd34e;border-radius:999px;",
        "color:#ffd34e;font:700 .72rem Orbitron,sans-serif;letter-spacing:.06em}",
        "#hk-brief .b-goal{margin:14px 0 16px;font-size:1.08rem;line-height:1.5;color:#dff4ff}",
        "#hk-brief .b-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:14px}",
        "#hk-brief h2{margin:0 0 8px;font:700 .72rem Orbitron,sans-serif;letter-spacing:.16em;color:#91ff6f}",
        "#hk-brief .b-box{border:1px solid #2d6580;border-radius:12px;padding:12px 14px;background:rgba(4,12,24,.6)}",
        "#hk-brief ol{margin:0;padding-left:20px;line-height:1.5;font-size:.98rem}",
        "#hk-brief ol li{margin-bottom:4px}",
        "#hk-brief .b-key{display:flex;gap:10px;align-items:center;margin-bottom:8px;font-size:.95rem}",
        "#hk-brief .b-key kbd{flex:0 0 auto;padding:4px 9px;border:1px solid #4b819d;border-bottom-width:3px;",
        "border-radius:6px;background:#193b57;font:700 .7rem Orbitron,sans-serif;color:#fff;white-space:nowrap}",
        "#hk-brief .b-lives{margin-top:12px;padding:9px 11px;border-radius:9px;border:1px solid #ff496f;",
        "background:rgba(255,73,111,.1);color:#ffc2ce;font-size:.92rem;line-height:1.45}",
        "#hk-brief .b-level{margin-top:14px;padding:12px 14px;border-radius:12px;border:1px dashed #ffd34e;",
        "background:rgba(255,211,78,.08)}",
        "#hk-brief .b-level h2{color:#ffd34e}",
        "#hk-brief .b-level p{margin:0;font-size:1.02rem;line-height:1.45}",
        "#hk-brief .b-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;flex-wrap:wrap}",
        "#hk-brief .b-foot small{color:#91adc0}",
        "#hk-brief .b-start{border:0;border-radius:12px;padding:13px 26px;cursor:pointer;",
        "background:linear-gradient(90deg,#45f3ff,#91ff6f);color:#06111c;font:900 .95rem Orbitron,sans-serif;",
        "letter-spacing:.08em;box-shadow:0 0 22px rgba(69,243,255,.45)}",
        "#hk-brief .b-start:focus-visible{outline:3px solid #fff;outline-offset:3px}",
        "#hk-help{position:fixed;right:126px;bottom:14px;z-index:9998;border:1px solid #367c9d;border-radius:999px;",
        "background:#102742;color:#eefaff;cursor:pointer;padding:8px 14px;font:700 12px Orbitron,sans-serif;",
        "box-shadow:0 4px 14px rgba(0,0,0,.45)}",
        "@media (max-width:700px){#hk-brief .b-grid{grid-template-columns:1fr}#hk-brief .b-card{padding:18px}}"
    ].join("");

    var root = null;
    var startCallback = null;

    function esc(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function levelHTML() {

        var n = Math.max(0, Math.min(currentLevel(), brief.levels.length - 1));

        return "<h2>LEVEL " + (n + 1) + " GUIDE</h2><p>" + esc(brief.levels[n]) + "</p>";
    }

    function build() {

        var doc = global.document;

        var style = doc.createElement("style");
        style.textContent = CSS;
        doc.head.appendChild(style);

        root = doc.createElement("div");
        root.id = "hk-brief";
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-modal", "true");
        root.setAttribute("aria-labelledby", "hk-brief-title");

        root.innerHTML =
            "<div class='b-card'>" +
                "<div class='b-kicker'>MISSION " + String(MISSION).padStart(2, "0") + " &middot; BRIEFING</div>" +
                "<h1 id='hk-brief-title'>" + esc(brief.title) + "</h1>" +
                "<span class='b-topic'>YOU WILL LEARN: " + esc(brief.topic.toUpperCase()) + "</span>" +
                "<p class='b-goal'>" + esc(brief.goal) + "</p>" +
                "<div class='b-grid'>" +
                    "<div class='b-box'><h2>HOW TO WIN</h2><ol>" +
                        brief.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") +
                    "</ol></div>" +
                    "<div class='b-box'><h2>CONTROLS</h2>" +
                        brief.controls.map(function (c) {
                            return "<div class='b-key'><kbd>" + esc(c[0]) + "</kbd><span>" + esc(c[1]) + "</span></div>";
                        }).join("") +
                        "<div class='b-lives'>&#10084; " + esc(LIVES_RULE) + "</div>" +
                    "</div>" +
                "</div>" +
                "<div class='b-level' id='hk-brief-level'></div>" +
                "<div class='b-foot'>" +
                    "<small>Press ENTER or click START. Open this again any time with ? HOW TO PLAY.</small>" +
                    "<button type='button' class='b-start' id='hk-brief-start'>START MISSION &#9654;</button>" +
                "</div>" +
            "</div>";

        doc.body.appendChild(root);

        doc.getElementById("hk-brief-start").addEventListener("click", close);

        var help = doc.createElement("button");
        help.id = "hk-help";
        help.type = "button";
        help.textContent = "? HOW TO PLAY";
        help.addEventListener("click", function () {
            help.blur();
            open();
        });
        doc.body.appendChild(help);

        /* the game must not see keys pressed while reading -
           capture on window runs before the game's own handlers */
        global.addEventListener("keydown", function (e) {

            if (!isOpen()) {
                return;
            }

            if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                close();
            }

            if (e.key !== "Tab") {
                e.stopImmediatePropagation();
                if (e.key !== "Enter" && e.key !== "Escape") {
                    e.preventDefault();
                }
            }
        }, true);
    }

    function isOpen() {
        return !!root && !root.classList.contains("hk-hidden");
    }

    function open() {

        if (!root) {
            return;
        }

        global.document.getElementById("hk-brief-level").innerHTML = levelHTML();
        root.classList.remove("hk-hidden");
        hold();

        var start = global.document.getElementById("hk-brief-start");
        if (start) {
            start.focus();
        }
    }

    function close() {

        if (!isOpen()) {
            return;
        }

        root.classList.add("hk-hidden");
        release();

        if (global.HackoAudio) {
            global.HackoAudio.play("select");
        }

        var run = startCallback;
        startCallback = null;

        if (run) {
            try { run(); } catch (e) { /* never block the game */ }
        }
    }

    global.HackoBriefing = {
        open: open,
        close: close,
        isOpen: isOpen,

        /* a game with its own start button can hand it over,
           so the player presses START once, not twice */
        onFirstStart: function (fn) {
            startCallback = fn;
        },

        BRIEFS: BRIEFS
    };

    function boot() {
        build();
        open();

        /* games restore the saved level on load - refresh the
           level guide once they have */
        global.addEventListener("load", function () {
            global.setTimeout(function () {
                if (isOpen()) {
                    global.document.getElementById("hk-brief-level").innerHTML = levelHTML();
                }
            }, 60);
        });
    }

    if (global.document.readyState === "loading") {
        global.document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }

}(window));
