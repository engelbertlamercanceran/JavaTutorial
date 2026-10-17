/* =========================================================
   HACKO - shared/tutorial.js
   The Level 1 tutorial every game can show.

       <script src="shared/tutorial.js"></script>

   The panel asked for a tutorial on Level 1 of every game: a
   pop-up that shows the player what to collect and what each
   object is. The briefing already says it in words; this
   points at the real thing on screen. The game is frozen, a
   ring circles one object at a time, and a card beside it
   says what it is and what to do with it.

   Each game knows where its own objects are, so each game
   hands over its steps:

       HackoTutorial.define({
           steps: [
               { title: "DATA CHIP",
                 text: "Run into it to collect it.",
                 focus: function () { ...scroll the camera to it... },
                 at: function () {
                     return { canvas: c, x: 480, y: 240, w: 44, h: 44 };
                 } },
               { title: "LIVES", text: "No ring for this one." }
           ],
           done: function () { ...put the camera back... }
       });

   at() may return { canvas, x, y, w, h } in the canvas's own
   pixels, { el } for a page element, or null for a card in
   the middle. It runs on the first START of Level 1 for each
   player (once), and again from the briefing's TUTORIAL
   button. Load it after briefing.js and before the game.
========================================================= */

(function (global) {
    "use strict";

    var doc = global.document;

    if (!doc) {
        return;
    }

    var tour = null;
    var root = null;
    var index = 0;

    /* ---------------------------------------------------
       SEEN ONCE PER PLAYER PER GAME
    --------------------------------------------------- */

    function mission() {
        var s = doc.querySelector("script[data-mission]");
        return s ? s.getAttribute("data-mission") : "0";
    }

    function seenKey() {
        var store = global.HackoStore;
        var user = store && store.activeUser ? store.activeUser() : "";
        return "hacko:tutorial:" + (user || "guest") + ":" + mission();
    }

    function seen() {
        try {
            return global.localStorage.getItem(seenKey()) === "true";
        } catch (e) {
            return true;
        }
    }

    function markSeen() {
        try {
            global.localStorage.setItem(seenKey(), "true");
        } catch (e) {
            /* private browsing - it shows again next time */
        }
    }


    /* ---------------------------------------------------
       THE SCREEN
    --------------------------------------------------- */

    var CSS = [
        "#hk-tut{position:fixed;inset:0;z-index:10002;font-family:Rajdhani,'Segoe UI',sans-serif;color:#eefaff}",
        "#hk-tut.hk-hidden{display:none}",
        "#hk-tut .t-shade{position:fixed;inset:0;background:rgba(3,9,18,.62)}",
        "#hk-tut .t-ring{position:fixed;box-sizing:border-box;border:3px solid #ffd34e;border-radius:14px;pointer-events:none;",
        "box-shadow:0 0 0 9999px rgba(3,9,18,.62),0 0 26px #ffd34e;animation:hkTutPulse 1.2s ease-in-out infinite}",
        "#hk-tut.t-free .t-ring{display:none}",
        "#hk-tut:not(.t-free) .t-shade{display:none}",
        "@keyframes hkTutPulse{50%{box-shadow:0 0 0 9999px rgba(3,9,18,.62),0 0 4px #ffd34e}}",
        "#hk-tut .t-card{position:fixed;width:min(340px,calc(100vw - 32px));box-sizing:border-box;padding:14px 16px;",
        "border:2px solid #ffd34e;border-radius:14px;background:linear-gradient(160deg,#0f2743,#07111f 70%);",
        "box-shadow:0 18px 50px #000}",
        "#hk-tut .t-kicker{font:700 .66rem Orbitron,sans-serif;letter-spacing:.18em;color:#ffd34e}",
        "#hk-tut h3{margin:4px 0 6px;font:900 1.05rem Orbitron,sans-serif;color:#45f3ff}",
        "#hk-tut p{margin:0 0 12px;font-size:1.05rem;line-height:1.45;color:#dff4ff}",
        "#hk-tut .t-row{display:flex;justify-content:space-between;align-items:center;gap:10px}",
        "#hk-tut button{border-radius:10px;cursor:pointer;font:900 .78rem Orbitron,sans-serif;letter-spacing:.06em;padding:9px 16px}",
        "#hk-tut .t-skip{border:1px solid #367c9d;background:transparent;color:#91adc0}",
        "#hk-tut .t-next{border:0;background:linear-gradient(90deg,#45f3ff,#91ff6f);color:#06111c}",
        "#hk-tut button:focus-visible{outline:3px solid #fff;outline-offset:3px}"
    ].join("");

    function build() {

        var style = doc.createElement("style");
        style.textContent = CSS;
        doc.head.appendChild(style);

        root = doc.createElement("div");
        root.id = "hk-tut";
        root.className = "hk-hidden";
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-modal", "true");
        root.setAttribute("aria-labelledby", "hk-tut-title");

        root.innerHTML =
            "<div class='t-shade'></div>" +
            "<div class='t-ring' id='hk-tut-ring'></div>" +
            "<div class='t-card' id='hk-tut-card'>" +
                "<div class='t-kicker' id='hk-tut-step'></div>" +
                "<h3 id='hk-tut-title'></h3>" +
                "<p id='hk-tut-text'></p>" +
                "<div class='t-row'>" +
                    "<button type='button' class='t-skip' id='hk-tut-skip'>SKIP</button>" +
                    "<button type='button' class='t-next' id='hk-tut-next'>NEXT &#9654;</button>" +
                "</div>" +
            "</div>";

        doc.body.appendChild(root);

        doc.getElementById("hk-tut-next").addEventListener("click", next);
        doc.getElementById("hk-tut-skip").addEventListener("click", finish);

        /* the game must not see keys pressed during the tour -
           capture on window runs before the game's own handlers */
        global.addEventListener("keydown", function (e) {

            if (!isOpen()) {
                return;
            }

            if (e.key === "Escape") {
                finish();
            } else if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
                next();
            }

            if (e.key !== "Tab") {
                e.preventDefault();
            }

            e.stopImmediatePropagation();
        }, true);

        global.addEventListener("resize", function () {
            if (isOpen()) {
                place();
            }
        });
    }

    function isOpen() {
        return !!root && !root.classList.contains("hk-hidden");
    }


    /* ---------------------------------------------------
       WHERE THE OBJECT IS ON SCREEN
    --------------------------------------------------- */

    /* canvas pixels -> page pixels, allowing for a canvas that is
       scaled, and for one letterboxed by object-fit: contain */
    function canvasRect(spec) {

        var c = spec.canvas;
        var box = c.getBoundingClientRect();
        var scale = Math.min(box.width / c.width, box.height / c.height);
        var left = box.left + (box.width - c.width * scale) / 2;
        var top = box.top + (box.height - c.height * scale) / 2;

        return {
            left: left + spec.x * scale,
            top: top + spec.y * scale,
            width: (spec.w || 0) * scale,
            height: (spec.h || 0) * scale
        };
    }

    function targetRect(step) {

        var spec = null;

        try {
            spec = step.at ? step.at() : null;
        } catch (e) {
            spec = null;
        }

        if (!spec) {
            return null;
        }

        /* a panel in a scrolling side column may be out of sight */
        if (spec.el && spec.el.scrollIntoView) {
            spec.el.scrollIntoView({ block: "nearest", inline: "nearest" });
        }

        var r = spec.canvas ? canvasRect(spec) :
            spec.el ? spec.el.getBoundingClientRect() : null;

        if (!r || (!r.width && !r.height)) {
            return null;
        }

        /* an object off the edge of the screen gets the centre card */
        if (r.left + r.width < 0 || r.top + r.height < 0 ||
            r.left > global.innerWidth || r.top > global.innerHeight) {
            return null;
        }

        /* padded, and kept inside the window so the ring stays visible */
        var pad = 8;
        var left = Math.max(4, r.left - pad);
        var top = Math.max(4, r.top - pad);
        var right = Math.min(global.innerWidth - 4, r.left + r.width + pad);
        var bottom = Math.min(global.innerHeight - 4, r.top + r.height + pad);

        return {
            left: left,
            top: top,
            width: right - left,
            height: bottom - top
        };
    }

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function place() {

        var step = tour.steps[index];
        var ring = doc.getElementById("hk-tut-ring");
        var card = doc.getElementById("hk-tut-card");
        var r = targetRect(step);
        var vw = global.innerWidth;
        var vh = global.innerHeight;
        var cw = card.offsetWidth;
        var ch = card.offsetHeight;
        var gap = 16;
        var x;
        var y;

        root.classList.toggle("t-free", !r);

        if (!r) {
            card.style.left = Math.round((vw - cw) / 2) + "px";
            card.style.top = Math.round((vh - ch) / 2) + "px";
            return;
        }

        ring.style.left = r.left + "px";
        ring.style.top = r.top + "px";
        ring.style.width = r.width + "px";
        ring.style.height = r.height + "px";

        /* beside the ring if there is room, else below, else above */
        if (r.left + r.width + gap + cw <= vw - 8) {
            x = r.left + r.width + gap;
            y = r.top + r.height / 2 - ch / 2;
        } else if (r.left - gap - cw >= 8) {
            x = r.left - gap - cw;
            y = r.top + r.height / 2 - ch / 2;
        } else if (r.top + r.height + gap + ch <= vh - 8) {
            x = r.left + r.width / 2 - cw / 2;
            y = r.top + r.height + gap;
        } else {
            x = r.left + r.width / 2 - cw / 2;
            y = r.top - gap - ch;
        }

        card.style.left = Math.round(clamp(x, 8, vw - cw - 8)) + "px";
        card.style.top = Math.round(clamp(y, 8, vh - ch - 8)) + "px";
    }


    /* ---------------------------------------------------
       THE TOUR
    --------------------------------------------------- */

    function show() {

        var step = tour.steps[index];
        var last = index === tour.steps.length - 1;

        if (step.focus) {
            try { step.focus(); } catch (e) { /* the card still shows */ }
        }

        doc.getElementById("hk-tut-step").textContent =
            "LEVEL 1 TUTORIAL · " + (index + 1) + " / " + tour.steps.length;
        doc.getElementById("hk-tut-title").textContent = step.title;
        doc.getElementById("hk-tut-text").textContent = step.text;
        doc.getElementById("hk-tut-next").innerHTML = last ? "GOT IT &#10003;" : "NEXT &#9654;";

        place();

        /* a step's focus() may move the camera; measure again once
           the frame it drew is on screen */
        global.setTimeout(function () {
            if (isOpen()) {
                place();
            }
        }, 60);
    }

    function next() {

        if (index < tour.steps.length - 1) {
            index += 1;
            if (global.HackoAudio) {
                global.HackoAudio.play("select");
            }
            show();
        } else {
            finish();
        }
    }

    function finish() {

        if (!isOpen()) {
            return;
        }

        root.classList.add("hk-hidden");

        if (tour.done) {
            try { tour.done(); } catch (e) { /* never block the game */ }
        }

        if (global.HackoBriefing && global.HackoBriefing.resume) {
            global.HackoBriefing.resume();
        }

        if (global.HackoAudio) {
            global.HackoAudio.play("select");
        }
    }

    function start() {

        if (!tour || !tour.steps.length || isOpen()) {
            return;
        }

        if (!root) {
            build();
        }

        markSeen();
        index = 0;

        if (global.HackoBriefing && global.HackoBriefing.pause) {
            global.HackoBriefing.pause();
        }

        root.classList.remove("hk-hidden");
        show();
        doc.getElementById("hk-tut-next").focus();
    }

    /* the first START of Level 1 runs it, once per player */
    global.addEventListener("hacko:briefingclosed", function (e) {

        var level = e.detail ? e.detail.level : 0;

        if (tour && level === 0 && !seen()) {
            /* let the game draw its first frame before measuring */
            global.setTimeout(start, 350);
        }
    });

    global.HackoTutorial = {

        define: function (t) {
            tour = t && t.steps ? t : null;
        },

        has: function () {
            return !!tour;
        },

        start: start
    };

}(window));
