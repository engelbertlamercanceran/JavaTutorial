/* =========================================================
   HACKO - shared/shop.js
   The coin shop on the mission map.

   Coins come from clearing levels (see COIN SHOP in
   storage.js) and buy LOOKS ONLY: a colour for Hacko in
   every game, and a theme for this map. Nothing sold here
   helps a player pass a level.

   Loaded by map.html after storage.js. It adds a COINS card
   and a SHOP button to the player row, the shop window, and
   the map themes.
========================================================= */

(function (global) {
    "use strict";

    var doc = global.document;
    var Store = global.HackoStore;

    if (!doc || !Store || !Store.SHOP_ITEMS) {
        return;
    }

    var CSS = [
        /* ---------- map themes ---------- */
        "body[data-hacko-theme='theme-midnight']{background:radial-gradient(circle at 80% 12%,rgba(255,255,230,.55) 0 3%,transparent 3.4%),linear-gradient(to bottom,#081430 0%,#13284d 40%,#1d3557 70%,#0b1626 100%) fixed}",
        "body[data-hacko-theme='theme-midnight'] .background{background:radial-gradient(1px 1px at 10% 20%,#fff,transparent),radial-gradient(1px 1px at 30% 8%,#fff,transparent),radial-gradient(1.5px 1.5px at 55% 25%,#fff,transparent),radial-gradient(1px 1px at 70% 6%,#fff,transparent),radial-gradient(1px 1px at 92% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 18% 38%,#fff,transparent),radial-gradient(1px 1px at 45% 42%,#fff,transparent),linear-gradient(to bottom,transparent 55%,rgba(5,10,25,.55))}",

        "body[data-hacko-theme='theme-sunset']{background:radial-gradient(circle at 50% 62%,rgba(255,230,140,.75) 0 7%,transparent 18%),linear-gradient(to bottom,#ffb36b 0%,#f4845f 32%,#b5577a 62%,#3d2645 100%) fixed}",
        "body[data-hacko-theme='theme-sunset'] .background{background:linear-gradient(to bottom,transparent 55%,rgba(40,15,40,.45))}",

        "body[data-hacko-theme='theme-sakura']{background:linear-gradient(to bottom,#ffe4ee 0%,#ffc8dd 35%,#c992b1 70%,#6d4a63 100%) fixed}",
        "body[data-hacko-theme='theme-sakura'] .background{background:radial-gradient(4px 3px at 12% 18%,#fff0f6,transparent),radial-gradient(4px 3px at 38% 9%,#ffd6e7,transparent),radial-gradient(3px 3px at 64% 22%,#fff0f6,transparent),radial-gradient(4px 3px at 86% 12%,#ffd6e7,transparent),radial-gradient(3px 3px at 24% 34%,#fff0f6,transparent),radial-gradient(4px 3px at 74% 38%,#fff0f6,transparent),linear-gradient(to bottom,transparent 55%,rgba(70,30,60,.35))}",

        "body[data-hacko-theme='theme-neon']{background:linear-gradient(to bottom,#0d0221 0%,#2b0a4a 45%,#3d0e5e 70%,#12002b 100%) fixed}",
        "body[data-hacko-theme='theme-neon'] .background{background:linear-gradient(to bottom,transparent 50%,rgba(255,0,200,.12)),repeating-linear-gradient(90deg,rgba(0,229,255,.18) 0 1px,transparent 1px 70px),repeating-linear-gradient(0deg,rgba(255,0,200,.14) 0 1px,transparent 1px 70px)}",

        /* ---------- coins card + shop button ---------- */
        ".hk-coins-card{cursor:pointer;font:inherit;color:inherit}",
        ".hk-coins-card:hover,.hk-coins-card:focus-visible{border-color:#ffd35c;outline:none;transform:translateY(-1px)}",
        ".hk-shop-btn{border:1px solid #ffd35c;border-radius:999px;background:linear-gradient(#ffd35c,#d99a2b);color:#2a1a06;cursor:pointer;padding:7px 14px;margin-left:8px;white-space:nowrap;font:700 12px Orbitron,sans-serif;box-shadow:0 3px 8px rgba(0,0,0,.35)}",
        ".hk-shop-btn:hover,.hk-shop-btn:focus-visible{filter:brightness(1.08);outline:2px solid #fff3c4;outline-offset:2px}",

        /* ---------- shop window ---------- */
        ".hk-shop{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,10,14,.72);backdrop-filter:blur(3px)}",
        ".hk-shop[hidden]{display:none}",
        ".hk-shop-panel{width:min(880px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;border:3px solid #bda77e;border-radius:12px;background:linear-gradient(rgba(58,49,38,.98),rgba(30,27,24,.98));box-shadow:0 18px 50px rgba(0,0,0,.6);color:#f3ead9;font-family:Arial,Helvetica,sans-serif;overflow:hidden}",
        ".hk-shop-head{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:2px solid #6b5a43;flex-wrap:wrap}",
        ".hk-shop-title{font:900 22px Orbitron,Arial,sans-serif;letter-spacing:2px;color:#e8e1d5;flex:1;min-width:160px}",
        ".hk-shop-balance{padding:6px 14px;border-radius:999px;border:2px solid #ffd35c;background:#2a2216;color:#ffd35c;font-weight:900;font-size:18px;white-space:nowrap}",
        ".hk-shop-close{width:38px;height:38px;border-radius:50%;border:2px solid #bda77e;background:#2a2520;color:#f3ead9;font-size:20px;line-height:1;cursor:pointer}",
        ".hk-shop-close:hover,.hk-shop-close:focus-visible{border-color:#ffd35c;outline:none}",
        ".hk-shop-tabs{display:flex;gap:8px;padding:12px 20px 0}",
        ".hk-shop-tab{flex:0 0 auto;padding:9px 16px;border-radius:8px 8px 0 0;border:2px solid #6b5a43;border-bottom:none;background:#2a2520;color:#d3bd8b;font-weight:900;font-size:13px;letter-spacing:1px;cursor:pointer}",
        ".hk-shop-tab[aria-selected='true']{background:#4b3f30;color:#fff;border-color:#bda77e}",
        ".hk-shop-body{padding:16px 20px;overflow-y:auto;border-top:2px solid #6b5a43}",
        ".hk-shop-note{margin:0 0 14px;color:#d3bd8b;font-size:13px}",
        ".hk-shop-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}",
        ".hk-item{display:flex;flex-direction:column;border:2px solid #6b5a43;border-radius:10px;background:rgba(20,18,16,.6);overflow:hidden}",
        ".hk-item.is-on{border-color:#7fe7ff;box-shadow:0 0 0 2px rgba(127,231,255,.25)}",
        ".hk-item-art{height:130px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 70%,rgba(127,231,255,.18),transparent 65%),#1b1916}",
        ".hk-item-art img{max-height:118px;max-width:90%;object-fit:contain;filter:drop-shadow(0 4px 6px rgba(0,0,0,.5))}",
        ".hk-item-swatch{width:100%;height:100%;position:relative}",
        ".hk-item-swatch:after{content:'';position:absolute;left:0;right:0;bottom:0;height:38%;background:linear-gradient(160deg,rgba(0,0,0,.35) 0 40%,transparent 40%),linear-gradient(200deg,rgba(0,0,0,.45) 0 45%,transparent 45%)}",
        ".hk-item-info{padding:10px 10px 12px;display:flex;flex-direction:column;gap:8px;flex:1}",
        ".hk-item-name{font-weight:900;font-size:14px;color:#fff}",
        ".hk-item-btn{margin-top:auto;padding:8px 10px;border-radius:7px;border:2px solid #bda77e;background:#3a3127;color:#f3ead9;font-weight:900;font-size:13px;cursor:pointer}",
        ".hk-item-btn.buy{background:linear-gradient(#ffd35c,#d99a2b);border-color:#ffd35c;color:#2a1a06}",
        ".hk-item-btn.on{background:#123445;border-color:#7fe7ff;color:#7fe7ff;cursor:default}",
        ".hk-item-btn[disabled]:not(.on){opacity:.55;cursor:not-allowed}",
        ".hk-item-btn:not([disabled]):hover,.hk-item-btn:not([disabled]):focus-visible{filter:brightness(1.1);outline:2px solid #fff3c4;outline-offset:1px}",
        ".hk-item-need{font-size:11px;color:#d3bd8b;text-align:center}",
        ".hk-shop-foot{padding:12px 20px;border-top:2px solid #6b5a43;font-size:12px;color:#bfae8c;background:rgba(0,0,0,.18)}",
        ".hk-shop-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:10001;padding:10px 18px;border-radius:999px;background:#123445;border:2px solid #7fe7ff;color:#eafcff;font-weight:900;font-size:14px;box-shadow:0 6px 18px rgba(0,0,0,.5)}",
        "@media (max-width:520px){.hk-shop{padding:8px}.hk-shop-head,.hk-shop-body,.hk-shop-foot{padding-left:12px;padding-right:12px}.hk-shop-tabs{padding:10px 12px 0}.hk-shop-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hk-item-art{height:110px}.hk-shop-title{font-size:18px}}"
    ].join("\n");

    var activeSlot = "hacko";
    var overlay = null;
    var coinsValue = null;
    var lastFocus = null;

    function fmt(n) {
        return Number(n || 0).toLocaleString("en-US");
    }

    function sound(name) {
        if (global.HackoAudio) {
            try { global.HackoAudio.play(name); } catch (e) { /* sound is optional */ }
        }
    }

    function el(tag, cls, text) {
        var node = doc.createElement(tag);
        if (cls) { node.className = cls; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    /* ---------- themes ---------- */

    function applyTheme(id) {
        doc.body.setAttribute("data-hacko-theme", id || Store.equipped("theme"));
    }

    /* ---------- coins card + button ---------- */

    function paintCoins() {
        if (coinsValue) {
            coinsValue.textContent = "🪙 " + fmt(Store.coinBalance());
        }
    }

    function mountHud() {

        var row = doc.querySelector(".player-hud");

        if (!row) {
            return;
        }

        var card = el("button", "stat-card hk-coins-card");
        card.type = "button";
        card.title = "Coins come from clearing levels. Spend them in the shop.";
        card.appendChild(el("span", "stat-label", "COINS"));
        coinsValue = el("span", "stat-value points", "🪙 0");
        card.appendChild(coinsValue);
        card.addEventListener("click", open);
        row.appendChild(card);

        var btn = el("button", "hk-shop-btn", "🛒 SHOP");
        btn.type = "button";
        btn.addEventListener("click", open);
        row.appendChild(btn);

        paintCoins();
    }

    /* ---------- shop window ---------- */

    function build() {

        overlay = el("div", "hk-shop");
        overlay.hidden = true;
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-label", "Hacko shop");

        overlay.innerHTML =
            "<div class='hk-shop-panel'>" +
              "<div class='hk-shop-head'>" +
                "<div class='hk-shop-title'>HACKO SHOP</div>" +
                "<div class='hk-shop-balance' data-balance></div>" +
                "<button type='button' class='hk-shop-close' aria-label='Close shop'>✕</button>" +
              "</div>" +
              "<div class='hk-shop-tabs' role='tablist'></div>" +
              "<div class='hk-shop-body'>" +
                "<p class='hk-shop-note' data-note></p>" +
                "<div class='hk-shop-grid' data-grid></div>" +
              "</div>" +
              "<div class='hk-shop-foot'>Earn coins by clearing a level for the first time. " +
                "Coins only change how things look - they never help you pass a level.</div>" +
            "</div>";

        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) { close(); }
        });

        overlay.querySelector(".hk-shop-close").addEventListener("click", close);

        doc.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && overlay && !overlay.hidden) { close(); }
        });

        var tabs = overlay.querySelector(".hk-shop-tabs");

        Object.keys(Store.SHOP_SLOTS).forEach(function (slot) {
            var tab = el("button", "hk-shop-tab", Store.SHOP_SLOTS[slot].title.toUpperCase());
            tab.type = "button";
            tab.setAttribute("role", "tab");
            tab.setAttribute("data-slot", slot);
            tab.addEventListener("click", function () {
                activeSlot = slot;
                sound("select");
                render();
            });
            tabs.appendChild(tab);
        });

        doc.body.appendChild(overlay);
    }

    function render() {

        var balance = Store.coinBalance();
        var test = Store.isTestMode && Store.isTestMode();
        var worn = Store.equipped(activeSlot);

        overlay.querySelector("[data-balance]").textContent = "🪙 " + fmt(balance);
        overlay.querySelector("[data-note]").textContent =
            Store.SHOP_SLOTS[activeSlot].note +
            (test ? " Test mode: everything is free to try and nothing is saved to the player." : "");

        Array.prototype.forEach.call(overlay.querySelectorAll(".hk-shop-tab"), function (t) {
            t.setAttribute("aria-selected", String(t.getAttribute("data-slot") === activeSlot));
        });

        var grid = overlay.querySelector("[data-grid]");
        grid.innerHTML = "";

        Store.SHOP_ITEMS.filter(function (it) {
            return it.slot === activeSlot;
        }).forEach(function (it) {

            var owned = Store.ownsItem(it.id);
            var on = worn === it.id;
            var card = el("div", "hk-item" + (on ? " is-on" : ""));
            var art = el("div", "hk-item-art");

            if (it.slot === "hacko") {
                var img = el("img");
                img.src = Store.shopFileUrl(it.id);
                img.alt = "Hacko in " + it.name;
                img.loading = "lazy";
                art.appendChild(img);
            } else {
                var sw = el("div", "hk-item-swatch");
                sw.style.background = "linear-gradient(to bottom," + it.swatch[0] + "," + it.swatch[1] + ")";
                art.appendChild(sw);

                /* a quick look at the map with this theme */
                card.addEventListener("mouseenter", function () { applyTheme(it.id); });
                card.addEventListener("mouseleave", function () { applyTheme(); });
            }

            card.appendChild(art);

            var info = el("div", "hk-item-info");
            info.appendChild(el("div", "hk-item-name", it.name));

            var btn = el("button", "hk-item-btn");
            btn.type = "button";

            if (on) {
                btn.textContent = "✓ WEARING";
                if (it.slot === "theme") { btn.textContent = "✓ IN USE"; }
                btn.className += " on";
                btn.disabled = true;
            } else if (owned) {
                btn.textContent = it.slot === "theme" ? "USE" : "WEAR";
                btn.addEventListener("click", function () {
                    Store.equipItem(it.id);
                    sound("select");
                    afterChange();
                });
            } else {
                btn.textContent = "BUY 🪙 " + fmt(it.price);
                btn.className += " buy";
                if (balance < it.price) {
                    btn.disabled = true;
                    info.appendChild(btn);
                    info.appendChild(el("div", "hk-item-need", "Need " + fmt(it.price - balance) + " more"));
                    card.appendChild(info);
                    grid.appendChild(card);
                    return;
                }
                btn.addEventListener("click", function () {
                    var out = Store.buyItem(it.id);
                    if (out.ok) {
                        sound("unlock");
                        toast(it.name + " unlocked!");
                    } else {
                        sound("wrong");
                    }
                    afterChange();
                });
            }

            info.appendChild(btn);
            card.appendChild(info);
            grid.appendChild(card);
        });
    }

    function afterChange() {
        applyTheme();
        paintCoins();
        render();
    }

    function toast(text) {
        var t = el("div", "hk-shop-toast", "🎉 " + text);
        t.setAttribute("role", "status");
        doc.body.appendChild(t);
        setTimeout(function () {
            if (t.parentNode) { t.parentNode.removeChild(t); }
        }, 2200);
    }

    function open() {
        if (!overlay) { build(); }
        lastFocus = doc.activeElement;
        sound("select");
        render();
        overlay.hidden = false;
        overlay.querySelector(".hk-shop-close").focus();
    }

    function close() {
        overlay.hidden = true;
        applyTheme();
        if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
    }

    function start() {
        var style = el("style");
        style.textContent = CSS;
        doc.head.appendChild(style);
        applyTheme();
        mountHud();
    }

    if (doc.readyState === "loading") {
        doc.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }

    global.HackoShop = { open: open, close: close, applyTheme: applyTheme };

}(window));
