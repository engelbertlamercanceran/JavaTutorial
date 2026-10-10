/* =========================================================
   HACKO - shared/loading.js
   The start-up loading screen.

   Client: use the Hacko key art as a loading screen, with
   some movement on it and a (fake) delay. Nothing actually
   needs loading - the pages run straight from disk - so the
   bar is timed, not measured.

   Shown once per browser session, on the first page that
   includes this script (login.html). Coming back to the
   sign-in page later in the same session skips it.

       <script src="shared/loading.js" data-art="loading.jpg"></script>
========================================================= */

(function (global) {
    "use strict";

    var doc = global.document;
    var ownScript = doc && doc.currentScript;

    if (!doc) {
        return;
    }

    var ART = (ownScript && ownScript.getAttribute("data-art")) || "loading.jpg";
    var SEEN_KEY = "hacko:loaded";
    var DURATION = 5000;        /* ms the bar takes to fill */

    var STEPS = [
        "Booting Hacko",
        "Declaring variables",
        "Reading input",
        "Checking conditions",
        "Spinning up loops",
        "Filling arrays",
        "Calling methods",
        "Squashing bugs",
        "Building objects",
        "Ready"
    ];

    var TIPS = [
        "Every Java statement ends with a semicolon ;",
        "int holds whole numbers, double holds decimals.",
        "A String goes in \"double quotes\", a char in 'single quotes'.",
        "Arrays start counting at 0, not 1.",
        "== compares values, = assigns them.",
        "A for loop has three parts: start; condition; step.",
        "Stuck? Hints nudge first - they never give the answer away."
    ];

    function seen() {
        try {
            return global.sessionStorage.getItem(SEEN_KEY) === "1";
        } catch (e) {
            return false;
        }
    }

    function markSeen() {
        try {
            global.sessionStorage.setItem(SEEN_KEY, "1");
        } catch (e) {
            /* private mode - it just shows again next time */
        }
    }

    if (seen()) {
        return;
    }

    var reduced = global.matchMedia &&
        global.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var CSS = [
        "#hk-loader{position:fixed;inset:0;z-index:99999;overflow:hidden;background:#040b16;",
        "color:#eefaff;font-family:Rajdhani,'Segoe UI',sans-serif;transition:opacity .7s ease,visibility .7s}",
        "#hk-loader.done{opacity:0;visibility:hidden}",
        "#hk-loader .art{position:absolute;inset:0;background:url('" + ART + "') center/cover no-repeat;",
        "transform-origin:60% 40%;animation:hkKen 16s ease-in-out infinite alternate}",
        "#hk-loader .glow{position:absolute;inset:0;pointer-events:none;",
        "background:radial-gradient(circle at 63% 42%,rgba(69,243,255,.22),transparent 34%);",
        "mix-blend-mode:screen;animation:hkPulse 2.4s ease-in-out infinite}",
        "#hk-loader .sweep{position:absolute;top:-20%;bottom:-20%;width:22%;left:-30%;pointer-events:none;",
        "background:linear-gradient(100deg,transparent,rgba(160,250,255,.16),transparent);",
        "transform:skewX(-18deg);animation:hkSweep 4.5s ease-in-out 0.6s infinite}",
        "#hk-loader canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}",
        "#hk-loader .scan{position:absolute;inset:0;pointer-events:none;opacity:.18;",
        "background:repeating-linear-gradient(0deg,rgba(0,0,0,.55) 0 1px,transparent 1px 3px)}",
        "#hk-loader .shade{position:absolute;inset:0;pointer-events:none;",
        "background:radial-gradient(ellipse at center,transparent 45%,rgba(2,6,14,.75) 100%),",
        "linear-gradient(to top,rgba(2,6,14,.92) 0,rgba(2,6,14,.35) 26%,transparent 45%)}",
        "#hk-loader .panel{position:absolute;left:50%;bottom:6vh;transform:translateX(-50%);",
        "width:min(560px,calc(100% - 32px));text-align:center}",
        "#hk-loader .status{font:700 clamp(.8rem,2.4vw,1rem) Orbitron,sans-serif;letter-spacing:.14em;",
        "color:#45f3ff;text-shadow:0 0 12px rgba(69,243,255,.6);min-height:1.4em}",
        "#hk-loader .status::after{content:'_';animation:hkBlink .8s steps(1) infinite}",
        "#hk-loader .bar{position:relative;height:14px;margin:12px 0 8px;border:2px solid #45f3ff;",
        "border-radius:999px;background:rgba(4,16,30,.75);box-shadow:0 0 16px rgba(69,243,255,.35);overflow:hidden}",
        "#hk-loader .fill{position:absolute;inset:0 auto 0 0;width:0;border-radius:999px;",
        "background:linear-gradient(90deg,#1aa8ff,#45f3ff 60%,#91ff6f);box-shadow:0 0 12px #45f3ff;",
        "transition:width .25s ease-out}",
        "#hk-loader .fill::after{content:'';position:absolute;inset:0;",
        "background:repeating-linear-gradient(135deg,rgba(255,255,255,.22) 0 8px,transparent 8px 16px);",
        "animation:hkStripes .7s linear infinite}",
        "#hk-loader .meta{display:flex;justify-content:space-between;font:700 .78rem Orbitron,sans-serif;",
        "color:#91adc0;letter-spacing:.1em}",
        "#hk-loader .tip{margin-top:10px;font-size:clamp(.85rem,2.6vw,1.02rem);color:#d8f4ff;",
        "text-shadow:0 2px 6px #000}",
        "#hk-loader .tip b{color:#ffd34e}",
        /* a gentle drift - enough to feel alive without cropping the
           art's edges (the HUD corners and the topic signs) */
        "@keyframes hkKen{0%{transform:scale(1) translate(0,0)}",
        "50%{transform:scale(1.03) translate(-.5%,.3%)}100%{transform:scale(1.05) translate(.5%,-.4%)}}",
        "@keyframes hkPulse{0%,100%{opacity:.45}50%{opacity:1}}",
        "@keyframes hkSweep{0%{left:-30%}60%,100%{left:130%}}",
        "@keyframes hkBlink{50%{opacity:0}}",
        "@keyframes hkStripes{to{background-position:22.6px 0}}",
        "@media (prefers-reduced-motion:reduce){#hk-loader .art,#hk-loader .glow,#hk-loader .sweep,",
        "#hk-loader .fill::after{animation:none}}"
    ].join("");

    function el(tag, cls, text) {
        var node = doc.createElement(tag);
        if (cls) { node.className = cls; }
        if (text) { node.textContent = text; }
        return node;
    }

    /* ---- floating code sparks: little 0s, 1s and brackets
       drifting up past Hacko, like the art's own cyan glyphs ---- */
    function startSparks(canvas) {

        var ctx = canvas.getContext && canvas.getContext("2d");
        if (!ctx || reduced) {
            return function () {};
        }

        var GLYPHS = ["0", "1", "{", "}", ";", "<", "/>", "()", "+"];
        var dpr = Math.min(global.devicePixelRatio || 1, 2);
        var w = 0, h = 0, sparks = [], raf = 0, alive = true;

        function size() {
            w = canvas.clientWidth;
            h = canvas.clientHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function spawn(anywhere) {
            return {
                x: Math.random() * w,
                y: anywhere ? Math.random() * h : h + 20,
                vy: 0.25 + Math.random() * 0.7,
                drift: (Math.random() - 0.5) * 0.3,
                size: 10 + Math.random() * 12,
                life: 0.35 + Math.random() * 0.6,
                phase: Math.random() * Math.PI * 2,
                glyph: Math.random() < 0.35
                    ? null
                    : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
            };
        }

        size();
        global.addEventListener("resize", size);

        var count = Math.round(Math.min(70, Math.max(28, w / 22)));
        for (var i = 0; i < count; i += 1) {
            sparks.push(spawn(true));
        }

        function frame(t) {

            if (!alive) {
                return;
            }

            ctx.clearRect(0, 0, w, h);

            sparks.forEach(function (s, i) {

                s.y -= s.vy;
                s.x += s.drift + Math.sin(t / 900 + s.phase) * 0.15;

                if (s.y < -30) {
                    sparks[i] = spawn(false);
                    return;
                }

                var twinkle = 0.55 + 0.45 * Math.sin(t / 400 + s.phase);
                ctx.globalAlpha = s.life * twinkle;
                ctx.shadowColor = "#45f3ff";
                ctx.shadowBlur = 10;

                if (s.glyph) {
                    ctx.fillStyle = "#7ff8ff";
                    ctx.font = "700 " + s.size + "px Orbitron, monospace";
                    ctx.fillText(s.glyph, s.x, s.y);
                } else {
                    ctx.fillStyle = "#bffcff";
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, s.size / 7, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            ctx.globalAlpha = 1;
            raf = global.requestAnimationFrame(frame);
        }

        raf = global.requestAnimationFrame(frame);

        return function stop() {
            alive = false;
            global.cancelAnimationFrame(raf);
            global.removeEventListener("resize", size);
        };
    }

    function mount() {

        var style = el("style");
        style.textContent = CSS;
        doc.head.appendChild(style);

        var root = el("div");
        root.id = "hk-loader";
        root.setAttribute("role", "progressbar");
        root.setAttribute("aria-label", "Loading HACKO");
        root.setAttribute("aria-valuemin", "0");
        root.setAttribute("aria-valuemax", "100");

        var canvas = el("canvas");
        var panel = el("div", "panel");
        var status = el("div", "status", STEPS[0]);
        var bar = el("div", "bar");
        var fill = el("div", "fill");
        var meta = el("div", "meta");
        var label = el("span", "", "LOADING");
        var pct = el("span", "", "0%");
        var tip = el("div", "tip");
        var tipLabel = el("b", "", "TIP: ");

        tip.appendChild(tipLabel);
        tip.appendChild(doc.createTextNode(
            TIPS[Math.floor(Math.random() * TIPS.length)]
        ));

        bar.appendChild(fill);
        meta.appendChild(label);
        meta.appendChild(pct);
        panel.appendChild(status);
        panel.appendChild(bar);
        panel.appendChild(meta);
        panel.appendChild(tip);

        root.appendChild(el("div", "art"));
        root.appendChild(el("div", "glow"));
        root.appendChild(canvas);
        root.appendChild(el("div", "sweep"));
        root.appendChild(el("div", "scan"));
        root.appendChild(el("div", "shade"));
        root.appendChild(panel);

        doc.body.appendChild(root);
        doc.documentElement.style.overflow = "hidden";

        var stopSparks = startSparks(canvas);

        /* A fake delay that doesn't look fake: the bar moves in
           uneven jumps with the odd pause, rather than a smooth
           linear crawl. */
        var start = Date.now();
        var total = reduced ? 1400 : DURATION;
        var shown = 0;

        function ease(t) {
            return 1 - Math.pow(1 - t, 2.2);
        }

        function tick() {

            var t = Math.min(1, (Date.now() - start) / total);
            var target = Math.round(ease(t) * 100);

            /* hold for a beat around 40% and 80% */
            if (t < 1 && (target === 41 || target === 82) && Math.random() < 0.6) {
                target = shown;
            }

            if (target > shown) {
                shown = Math.min(100, target);
            }

            fill.style.width = shown + "%";
            pct.textContent = shown + "%";
            root.setAttribute("aria-valuenow", String(shown));
            status.textContent = STEPS[Math.min(STEPS.length - 1,
                Math.floor(shown / 100 * (STEPS.length - 1)))];

            if (shown >= 100) {
                label.textContent = "COMPLETE";
                global.setTimeout(finish, 450);
                return;
            }

            global.setTimeout(tick, 90 + Math.random() * 140);
        }

        function finish() {

            markSeen();
            root.classList.add("done");
            doc.documentElement.style.overflow = "";

            global.setTimeout(function () {
                stopSparks();
                if (root.parentNode) {
                    root.parentNode.removeChild(root);
                }
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }, 800);
        }

        tick();
    }

    if (doc.body) {
        mount();
    } else {
        doc.addEventListener("DOMContentLoaded", mount);
    }

}(window));
