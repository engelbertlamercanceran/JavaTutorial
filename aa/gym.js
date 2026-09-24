/* =========================================================
   HACKO - Debugging Gym overworld

   The client asked for the hero to walk through the gym
   "parang Pokemon gym style" (their reference was Dewford
   Gym). So the duels now live inside a top-down gym: Hacko
   walks the corridors, every bug trainer waits in an alcove
   beside the path, and stepping in front of one starts the
   duel. The corridors snake, so the trainers can only be
   met in order, ending with Gym Leader Vex on the platform.

       Gym.init({ canvas, dialog, text, trainers,
                  getFrontier, onBattle });
       Gym.returnFromBattle({ won, k, back });
       Gym.placeAt(k);
========================================================= */

(function (global) {
    "use strict";

    var T = 32;

    /* #  wall / floor boards      .  path
       H  where Hacko starts       P  leader platform
       B  bookshelf (platform)     S  statue
       M  entrance mat             0-9  trainers, 9 is Vex */
    var MAP = [
        "#####################",
        "#######BPP9PPB#######",
        "#######PPPPPPP#######",
        "######8###.##########",
        "#..............######",
        "#.###################",
        "#.##7##########5#####",
        "#...................#",
        "#########6#########.#",
        "###########3#######.#",
        "#...................#",
        "#.###2##########4####",
        "#.#1##0#S###S########",
        "#.........H..########",
        "##########M##########"
    ];

    var COLS = MAP[0].length;
    var ROWS = MAP.length;

    /* which way each trainer looks - into the corridor */
    var FACING = ["down", "down", "up", "down", "up",
                  "down", "up", "down", "down", "down"];

    /* where Hacko is put back when running out of lives
       sends him to face trainer k again */
    var SPAWN = [
        [10, 13, "left"], [5, 13, "left"], [3, 10, "right"],
        [8, 10, "right"], [13, 10, "right"], [18, 7, "left"],
        [12, 7, "left"], [7, 7, "left"], [3, 4, "right"],
        [10, 4, "up"]
    ];

    var DIRS = {
        up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]
    };

    var OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

    var KEYS = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right",
        W: "up", S: "down", A: "left", D: "right"
    };

    var STEP_MS = 190;

    var trainers = [];

    MAP.forEach(function (row, y) {
        row.split("").forEach(function (ch, x) {
            if (/[0-9]/.test(ch)) {
                var k = Number(ch);
                var d = DIRS[FACING[k]];
                trainers[k] = {
                    x: x, y: y, face: FACING[k],
                    sx: x + d[0], sy: y + d[1]
                };
            }
        });
    });

    var opts = null;
    var ctx = null;
    var board = null;           /* pre-rendered static tiles */
    var heroImg = new Image();
    heroImg.src = "hacko.png";

    var hero = {
        x: 10, y: 13, fx: 10, fy: 13, t: 1,
        face: "up", moving: false, steps: 0
    };

    var held = null;
    var locked = false;
    var bubble = null;          /* { k, until } */
    var lines = [];
    var afterDialog = null;
    var lastBump = 0;


    /* ---------------------------------------------------
       MAP QUERIES
    --------------------------------------------------- */

    function tile(x, y) {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) {
            return "#";
        }
        return MAP[y][x];
    }

    function trainerAt(x, y) {
        for (var k = 0; k < trainers.length; k++) {
            if (trainers[k].x === x && trainers[k].y === y) {
                return k;
            }
        }
        return -1;
    }

    function walkable(x, y) {
        var c = tile(x, y);
        return (c === "." || c === "H" || c === "P") && trainerAt(x, y) < 0;
    }

    /* anything drawn with the path colour underneath it */
    function floorLike(c) {
        return c !== "#";
    }

    function frontier() {
        return opts ? opts.getFrontier() : 0;
    }


    /* ---------------------------------------------------
       STATIC TILES
    --------------------------------------------------- */

    function drawBoards(g, x, y) {
        var px = x * T;
        var py = y * T;

        g.fillStyle = "#5c3321";
        g.fillRect(px, py, T, T);

        for (var i = 0; i < 4; i++) {
            g.fillStyle = "#4a2819";
            g.fillRect(px, py + i * 8 + 6, T, 2);

            /* staggered seams so the boards read as planks */
            var seam = (x * 13 + y * 7 + i * 11) % T;
            g.fillRect(px + seam, py + i * 8, 2, 6);
        }
    }

    function drawPath(g, x, y) {
        var px = x * T;
        var py = y * T;

        g.fillStyle = (x + y) % 2 ? "#a8a07c" : "#aea683";
        g.fillRect(px, py, T, T);

        g.fillStyle = "#9b9372";
        g.fillRect(px + ((x * 7) % 26) + 3, py + ((y * 11) % 24) + 4, 2, 2);
        g.fillRect(px + ((x * 5 + 13) % 26) + 3, py + ((y * 3 + 17) % 24) + 4, 2, 2);
    }

    function drawPlatform(g, x, y) {
        var px = x * T;
        var py = y * T;

        g.fillStyle = "#948cd0";
        g.fillRect(px, py, T, T);
        g.fillStyle = "#a39cdb";
        g.fillRect(px + 2, py + 2, T - 4, T - 4);
    }

    /* the light grey kerb around every path, and the teal
       ledge face where a wall drops down onto a path */
    function drawEdges(g, x, y) {
        var px = x * T;
        var py = y * T;

        if (floorLike(tile(x, y + 1))) {
            g.fillStyle = "#2d7582";
            g.fillRect(px, py + T - 12, T, 12);
            g.fillStyle = "#59b2bf";
            g.fillRect(px, py + T - 9, T, 2);
            g.fillRect(px, py + T - 4, T, 2);
            g.fillStyle = "#a9eef4";
            g.fillRect(px, py + T - 12, T, 2);
            g.fillStyle = "#d8d4c8";
            g.fillRect(px, py + T - 16, T, 4);
        }

        g.fillStyle = "#d8d4c8";

        if (floorLike(tile(x, y - 1))) {
            g.fillRect(px, py, T, 5);
        }
        if (floorLike(tile(x - 1, y))) {
            g.fillRect(px, py, 5, T);
        }
        if (floorLike(tile(x + 1, y))) {
            g.fillRect(px + T - 5, py, 5, T);
        }

        g.fillStyle = "#8a877c";

        if (floorLike(tile(x, y - 1))) {
            g.fillRect(px, py + 5, T, 1);
        }
        if (floorLike(tile(x - 1, y))) {
            g.fillRect(px + 5, py, 1, T);
        }
        if (floorLike(tile(x + 1, y))) {
            g.fillRect(px + T - 6, py, 1, T);
        }
    }

    function drawShelf(g, x, y) {
        var px = x * T;
        var py = y * T;

        g.fillStyle = "#6f6a2c";
        g.fillRect(px + 3, py + 2, T - 6, T - 4);

        for (var i = 0; i < 3; i++) {
            g.fillStyle = "#c9c35a";
            g.fillRect(px + 5, py + 4 + i * 9, T - 10, 6);
            g.fillStyle = "#8c8637";
            g.fillRect(px + 5, py + 9 + i * 9, T - 10, 1);
        }
    }

    function drawStatue(g, x, y) {
        var px = x * T;
        var py = y * T;

        g.fillStyle = "rgba(0,0,0,.25)";
        g.fillRect(px + 6, py + T - 6, T - 12, 4);

        g.fillStyle = "#9aa0a6";
        g.fillRect(px + 8, py + 14, T - 16, T - 18);
        g.fillStyle = "#c4c9ce";
        g.fillRect(px + 8, py + 14, T - 16, 3);
        g.fillStyle = "#7d8389";
        g.fillRect(px + 12, py + 20, T - 24, 6);

        g.fillStyle = "#b9bec4";
        g.beginPath();
        g.arc(px + T / 2, py + 10, 7, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#eef1f4";
        g.fillRect(px + T / 2 - 4, py + 6, 3, 3);
    }

    function drawMat(g, x, y) {
        var px = x * T;
        var py = y * T;

        drawPath(g, x, y);
        g.fillStyle = "#d9772b";
        g.fillRect(px + 2, py + 6, T - 4, T - 10);
        g.fillStyle = "#f3b05a";
        g.fillRect(px + 4, py + 8, T - 8, 2);
        g.fillRect(px + 4, py + T - 8, T - 8, 2);
    }

    function buildBoard() {
        board = document.createElement("canvas");
        board.width = COLS * T;
        board.height = ROWS * T;

        var g = board.getContext("2d");

        for (var y = 0; y < ROWS; y++) {
            for (var x = 0; x < COLS; x++) {
                var c = tile(x, y);

                if (c === "#") {
                    drawBoards(g, x, y);
                } else if (c === "P" || c === "B" ||
                           (y <= 2 && /[0-9]/.test(c))) {
                    drawPlatform(g, x, y);
                } else if (c === "M") {
                    drawMat(g, x, y);
                } else {
                    drawPath(g, x, y);
                }
            }
        }

        /* the carpet leading up to Vex */
        g.fillStyle = "#6259ad";
        g.fillRect(8 * T + 6, 1 * T + 4, 5 * T - 12, 2 * T - 4);
        g.fillStyle = "#c9c3f2";
        g.fillRect(8 * T + 6, 1 * T + 4, 5 * T - 12, 2);
        g.fillRect(10 * T + 10, 1 * T + 6, T - 20, 2 * T - 6);

        for (y = 0; y < ROWS; y++) {
            for (x = 0; x < COLS; x++) {
                c = tile(x, y);

                if (c === "#") {
                    drawEdges(g, x, y);
                } else if (c === "B") {
                    drawShelf(g, x, y);
                } else if (c === "S") {
                    drawStatue(g, x, y);
                }
            }
        }
    }


    /* ---------------------------------------------------
       SPRITES
    --------------------------------------------------- */

    function hue(k) {
        return (k * 39 + 8) % 360;
    }

    function drawTrainer(k, now) {
        var tr = trainers[k];
        var px = tr.x * T;
        var py = tr.y * T;
        var h = hue(k);
        var boss = k === 9;
        var face = tr.face;
        var beaten = k < frontier();

        ctx.fillStyle = "rgba(0,0,0,.28)";
        ctx.beginPath();
        ctx.ellipse(px + 16, py + 29, 10, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        if (boss) {
            ctx.fillStyle = "#b3202e";
            ctx.fillRect(px + 7, py + 12, 18, 15);
        }

        /* legs */
        ctx.fillStyle = "#23252b";
        ctx.fillRect(px + 11, py + 23, 4, 6);
        ctx.fillRect(px + 17, py + 23, 4, 6);

        /* body and arms */
        ctx.fillStyle = "hsl(" + h + ",62%,46%)";
        ctx.fillRect(px + 9, py + 13, 14, 11);
        ctx.fillStyle = "hsl(" + h + ",62%,34%)";
        ctx.fillRect(px + 6, py + 14, 3, 8);
        ctx.fillRect(px + 23, py + 14, 3, 8);
        ctx.fillStyle = "#f0c8a0";
        ctx.fillRect(px + 6, py + 21, 3, 2);
        ctx.fillRect(px + 23, py + 21, 3, 2);

        /* head */
        ctx.fillStyle = "#f0c8a0";
        ctx.fillRect(px + 10, py + 3, 12, 10);

        ctx.fillStyle = "hsl(" + h + ",35%,18%)";

        if (face === "up") {
            ctx.fillRect(px + 9, py + 1, 14, 11);
        } else {
            ctx.fillRect(px + 9, py + 1, 14, 4);
            ctx.fillRect(px + 9, py + 3, 2, 5);
            ctx.fillRect(px + 21, py + 3, 2, 5);

            ctx.fillStyle = "#1b1b1f";
            ctx.fillRect(px + 13, py + 7, 2, 3);
            ctx.fillRect(px + 18, py + 7, 2, 3);
        }

        if (boss) {
            ctx.fillStyle = "#ffd34e";
            ctx.fillRect(px + 10, py - 2, 12, 3);
            ctx.fillRect(px + 10, py - 5, 2, 3);
            ctx.fillRect(px + 15, py - 6, 2, 4);
            ctx.fillRect(px + 20, py - 5, 2, 3);
        }

        if (beaten) {
            ctx.fillStyle = "#1c7c3a";
            ctx.fillRect(px + 22, py - 6, 10, 10);
            ctx.fillStyle = "#b8ffc9";
            ctx.fillRect(px + 24, py - 1, 2, 2);
            ctx.fillRect(px + 26, py + 1, 2, 2);
            ctx.fillRect(px + 28, py - 3, 2, 4);
        } else if (k === frontier() && !bubble) {
            /* bobbing marker over the next trainer, so a beginner
               always knows where the gym wants them to go */
            var bob = Math.sin(now / 220) * 2;
            ctx.fillStyle = "#d5fa42";
            ctx.beginPath();
            ctx.moveTo(px + 11, py - 12 + bob);
            ctx.lineTo(px + 21, py - 12 + bob);
            ctx.lineTo(px + 16, py - 5 + bob);
            ctx.closePath();
            ctx.fill();
        }

        if (bubble && bubble.k === k) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(px + 8, py - 22, 16, 18);
            ctx.fillStyle = "#11120f";
            ctx.fillRect(px + 8, py - 22, 16, 2);
            ctx.fillRect(px + 8, py - 6, 16, 2);
            ctx.fillRect(px + 8, py - 22, 2, 18);
            ctx.fillRect(px + 22, py - 22, 2, 18);
            ctx.fillStyle = "#e0262e";
            ctx.fillRect(px + 15, py - 19, 3, 8);
            ctx.fillRect(px + 15, py - 9, 3, 2);
        }
    }

    function drawHero(now) {
        var p = hero.moving ? hero.t : 1;
        var x = (hero.fx + (hero.x - hero.fx) * p) * T;
        var y = (hero.fy + (hero.y - hero.fy) * p) * T;

        /* a hop per tile plus a side-to-side sway reads as a
           walk even though the sprite is a single image */
        var bob = hero.moving
            ? -Math.abs(Math.sin(p * Math.PI)) * 4
            : Math.sin(now / 400) * 0.8;

        var tilt = hero.moving
            ? (hero.steps % 2 ? 0.13 : -0.13) * Math.sin(p * Math.PI)
            : 0;

        ctx.fillStyle = "rgba(0,0,0,.3)";
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 29, 11 - (hero.moving ? 2 : 0), 4, 0, 0, Math.PI * 2);
        ctx.fill();

        if (!heroImg.complete || !heroImg.naturalWidth) {
            ctx.fillStyle = "#45f3ff";
            ctx.fillRect(x + 8, y + 4 + bob, 16, 24);
            return;
        }

        var w = 27;
        var h = 37;

        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.translate(x + 16, y + 30 + bob);
        ctx.rotate(tilt);

        if (hero.face === "left") {
            ctx.scale(-1, 1);
        }

        ctx.drawImage(heroImg, -w / 2, -h, w, h);
        ctx.restore();
    }

    function draw(now) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(board, 0, 0);

        /* draw in row order so whoever is lower overlaps */
        var heroRow = hero.moving ? Math.max(hero.y, hero.fy) : hero.y;
        var heroDrawn = false;

        for (var y = 0; y < ROWS; y++) {
            for (var k = 0; k < trainers.length; k++) {
                if (trainers[k].y === y) {
                    drawTrainer(k, now);
                }
            }
            if (y === heroRow) {
                drawHero(now);
                heroDrawn = true;
            }
        }

        if (!heroDrawn) {
            drawHero(now);
        }
    }


    /* ---------------------------------------------------
       MOVEMENT
    --------------------------------------------------- */

    function inMap() {
        return document.body.dataset.mode === "map";
    }

    function tryStep(dir) {
        var d = DIRS[dir];
        var nx = hero.x + d[0];
        var ny = hero.y + d[1];

        hero.face = dir;

        if (!walkable(nx, ny)) {
            var now = performance.now();
            if (now - lastBump > 300) {
                lastBump = now;
                HackoAudio.play("bump");
            }
            return;
        }

        hero.fx = hero.x;
        hero.fy = hero.y;
        hero.x = nx;
        hero.y = ny;
        hero.t = 0;
        hero.moving = true;
        hero.steps++;

        HackoAudio.play("tick");
    }

    function afterStep() {
        for (var k = frontier(); k < trainers.length; k++) {
            if (trainers[k].sx === hero.x && trainers[k].sy === hero.y) {
                encounter(k);
                return;
            }
        }
    }

    function name(k) {
        return opts.trainers[k].trainer;
    }

    function encounter(k) {
        locked = true;
        held = null;
        hero.face = OPPOSITE[trainers[k].face];
        bubble = { k: k };

        HackoAudio.play("open");

        setTimeout(function () {
            bubble = null;
            say([
                name(k) + ": “" + opts.trainers[k].quote + "”",
                name(k) + " wants to duel!"
            ], function () {
                startBattle(k);
            });
        }, 750);
    }

    function startBattle(k) {
        var frame = opts.canvas.parentNode;

        HackoAudio.play("unlock");
        frame.classList.remove("flash");
        void frame.offsetWidth;
        frame.classList.add("flash");

        setTimeout(function () {
            frame.classList.remove("flash");
            locked = false;
            opts.onBattle(k);
        }, 700);
    }

    function interact() {
        if (!opts.dialog.classList.contains("hidden")) {
            advance();
            return;
        }

        if (locked || hero.moving) {
            return;
        }

        var d = DIRS[hero.face];
        var k = trainerAt(hero.x + d[0], hero.y + d[1]);

        if (k < 0) {
            return;
        }

        if (k < frontier()) {
            HackoAudio.play("select");
            say([name(k) + ": “" + opts.trainers[k].lesson + "”"]);
        } else {
            encounter(k);
        }
    }


    /* ---------------------------------------------------
       DIALOG BOX
    --------------------------------------------------- */

    function say(list, done) {
        lines = list.slice();
        afterDialog = done || null;
        locked = true;
        held = null;
        opts.dialog.classList.remove("hidden");
        opts.text.textContent = lines.shift();
    }

    function advance() {
        HackoAudio.play("select");

        if (lines.length) {
            opts.text.textContent = lines.shift();
            return;
        }

        opts.dialog.classList.add("hidden");
        locked = false;

        var next = afterDialog;
        afterDialog = null;

        if (next) {
            next();
        }
    }


    /* ---------------------------------------------------
       LOOP + INPUT
    --------------------------------------------------- */

    var last = 0;

    function frame(now) {
        var dt = last ? now - last : 16;
        last = now;

        if (hero.moving) {
            hero.t += dt / STEP_MS;

            if (hero.t >= 1) {
                hero.t = 1;
                hero.moving = false;
                afterStep();
            }
        }

        if (!hero.moving && !locked && held && inMap()) {
            tryStep(held);
        }

        draw(now);
        requestAnimationFrame(frame);
    }

    function bindInput() {
        global.addEventListener("keydown", function (e) {
            if (!inMap()) {
                return;
            }

            if (KEYS[e.key]) {
                e.preventDefault();
                held = locked ? null : KEYS[e.key];
                return;
            }

            if (e.key === "e" || e.key === "E" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                interact();
            }
        });

        global.addEventListener("keyup", function (e) {
            if (KEYS[e.key] === held) {
                held = null;
            }
        });

        opts.dialog.addEventListener("click", interact);

        /* touch d-pad */
        var pad = document.getElementById("gym-pad");

        if (pad) {
            pad.querySelectorAll("[data-dir]").forEach(function (btn) {
                btn.addEventListener("pointerdown", function (e) {
                    e.preventDefault();
                    if (!locked) {
                        held = btn.dataset.dir;
                    }
                });
                ["pointerup", "pointerleave", "pointercancel"].forEach(function (evt) {
                    btn.addEventListener(evt, function () {
                        if (held === btn.dataset.dir) {
                            held = null;
                        }
                    });
                });
            });

            var talk = pad.querySelector("[data-act]");
            if (talk) {
                talk.addEventListener("click", interact);
            }
        }
    }


    /* ---------------------------------------------------
       PUBLIC
    --------------------------------------------------- */

    function placeAt(k) {
        var s = k <= 0
            ? [10, 13, "up"]
            : SPAWN[Math.min(k, SPAWN.length - 1)];

        hero.x = hero.fx = s[0];
        hero.y = hero.fy = s[1];
        hero.face = s[2];
        hero.moving = false;
        hero.t = 1;
    }

    global.Gym = {

        init: function (o) {
            opts = o;
            ctx = o.canvas.getContext("2d");
            buildBoard();
            placeAt(frontier());
            bindInput();
            requestAnimationFrame(frame);
        },

        placeAt: placeAt,

        returnFromBattle: function (r) {
            held = null;
            locked = false;

            if (r.won) {
                say(r.k === 9
                    ? [name(9) + ": “Impossible… my perfect code, patched.”",
                       "Hacko earned the Debug Badge! The Debugging Gym is cleared."]
                    : [name(r.k) + ": “My bug… patched?! Fine, go on ahead.”"]);
                return;
            }

            placeAt(r.back);
            say([
                "Hacko ran out of lives…",
                "Back to face " + name(r.back) + " again."
            ]);
        },

        reset: function () {
            placeAt(0);
            opts.dialog.classList.add("hidden");
            locked = false;
            bubble = null;
        },

        /* for tools/ - the map is checked for a clean route */
        MAP: MAP,
        trainers: trainers,
        SPAWN: SPAWN
    };

}(window));
