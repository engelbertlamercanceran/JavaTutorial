/* =========================================================
   HACKO - shared/badges.js
   The badge pop-up at the end of every game.

       <script src="shared/badges.js"></script>

   Load it after storage.js. When a mission's last level is
   cleared, HackoStore.completeLevel() fires
   "hacko:missioncomplete" and this shows the badge straight
   away - no NEXT button to press first. It also shows how
   many of the ten badges the player now holds, with the
   whole collection underneath, and links to the map where
   the same collection is kept.

   Finishing a mission again shows the pop-up again, marked
   as already collected.
========================================================= */

(function (global) {
    "use strict";

    var doc = global.document;

    if (!doc) {
        return;
    }

    /* Badges/ sits next to shared/, wherever the page is */
    var ownScript = doc.currentScript;
    var ROOT = ownScript && ownScript.src
        ? ownScript.src.replace(/shared\/badges\.js(\?.*)?$/, "")
        : "";

    /* let the game's own "level complete" moment land first */
    var DELAY = 900;

    var CSS = [
        "#hk-badge{position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;",
        "padding:16px;background:rgba(2,8,16,.82);font-family:Rajdhani,Segoe UI,sans-serif;color:#dff4ff;",
        "animation:hkBadgeFade .25s ease-out}",
        "#hk-badge .bd-card{width:min(520px,100%);max-height:100%;overflow:auto;box-sizing:border-box;",
        "padding:22px 20px 18px;border:2px solid #ffd34e;border-radius:18px;text-align:center;",
        "background:linear-gradient(160deg,#0f2742,#081626 75%);box-shadow:0 0 40px rgba(255,211,78,.28),0 14px 40px rgba(0,0,0,.6)}",
        "#hk-badge .bd-kicker{font:700 .72rem Orbitron,sans-serif;letter-spacing:.24em;color:#ffd34e}",
        "#hk-badge .bd-img{width:150px;height:150px;margin:10px auto 6px;display:flex;align-items:center;",
        "justify-content:center;font-size:84px;animation:hkBadgePop .6s cubic-bezier(.2,1.6,.4,1) both}",
        "#hk-badge .bd-img img{max-width:100%;max-height:100%;filter:drop-shadow(0 0 18px rgba(255,211,78,.55))}",
        "#hk-badge h2{margin:4px 0 2px;font:900 clamp(1.2rem,4.6vw,1.7rem) Orbitron,sans-serif;color:#45f3ff}",
        "#hk-badge .bd-for{margin:0;color:#91adc0}",
        "#hk-badge .bd-count{margin:16px 0 10px;font:700 1rem Orbitron,sans-serif}",
        "#hk-badge .bd-count b{color:#ffd34e;font-size:1.3rem}",
        "#hk-badge .bd-row{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:0 auto 18px;max-width:360px}",
        "#hk-badge .bd-slot{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:12px;",
        "border:1px solid #1f3b5a;background:#071421;font-size:22px}",
        "#hk-badge .bd-slot img{width:84%;height:84%;object-fit:contain}",
        "#hk-badge .bd-slot.off img{filter:grayscale(1) brightness(.35)}",
        "#hk-badge .bd-slot.on{border-color:#ffd34e;box-shadow:0 0 10px rgba(255,211,78,.3)}",
        "#hk-badge .bd-slot.now{animation:hkBadgeGlow 1.2s ease-in-out 3}",
        "#hk-badge .bd-actions{display:flex;gap:10px;flex-wrap:wrap}",
        "#hk-badge .bd-actions a,#hk-badge .bd-actions button{flex:1;min-width:150px;box-sizing:border-box;padding:12px 14px;",
        "border-radius:10px;font:700 .82rem Orbitron,sans-serif;letter-spacing:.06em;cursor:pointer;text-decoration:none}",
        "#hk-badge .bd-map{border:1px solid #45f3ff;background:transparent;color:#45f3ff}",
        "#hk-badge .bd-ok{border:0;background:#ffd34e;color:#1a1400}",
        "@keyframes hkBadgeFade{from{opacity:0}to{opacity:1}}",
        "@keyframes hkBadgePop{from{transform:scale(.2) rotate(-25deg);opacity:0}to{transform:none;opacity:1}}",
        "@keyframes hkBadgeGlow{50%{box-shadow:0 0 22px rgba(255,211,78,.9)}}"
    ].join("");

    var root = null;

    function esc(text) {
        return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
        });
    }

    function badgeImg(mission, alt) {
        return mission && mission.image
            ? "<img src=\"" + esc(ROOT + "Badges/" + mission.image) + "\" alt=\"" + esc(alt || "") +
              "\" onerror=\"this.replaceWith(document.createTextNode('🏅'))\">"
            : "🏅";
    }

    /* Enter, Space and Escape close the pop-up - and are kept
       from the game underneath while it is open */
    function onKey(event) {

        if (!root) {
            return;
        }

        if (event.key === "Enter" || event.key === "Escape" || event.key === " ") {
            event.preventDefault();
            if (event.type === "keydown") {
                close();
            }
        }

        event.stopImmediatePropagation();
    }

    function close() {

        if (!root) {
            return;
        }

        root.remove();
        root = null;

        global.removeEventListener("keydown", onKey, true);
        global.removeEventListener("keyup", onKey, true);
    }

    function show(detail) {

        var store = global.HackoStore;
        var missions = store && store.MISSIONS;

        if (!missions) {
            return;
        }

        close();

        var mission = missions[detail.mission] || {};
        var owned = detail.badges || [];
        var ids = Object.keys(missions);

        if (!doc.getElementById("hk-badge-style")) {
            var style = doc.createElement("style");
            style.id = "hk-badge-style";
            style.textContent = CSS;
            doc.head.appendChild(style);
        }

        var slots = ids.map(function (id) {
            var m = missions[id];
            var has = owned.indexOf(m.badge) !== -1;
            return "<div class=\"bd-slot " + (has ? "on" : "off") +
                (Number(id) === detail.mission ? " now" : "") +
                "\" title=\"" + esc(has ? m.badge : "Locked - finish " + m.title) + "\">" +
                badgeImg(m, has ? m.badge : "locked") + "</div>";
        }).join("");

        root = doc.createElement("div");
        root.id = "hk-badge";
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-modal", "true");
        root.setAttribute("aria-label", "Badge earned");

        root.innerHTML =
            "<div class=\"bd-card\">" +
                "<div class=\"bd-kicker\">" +
                    (detail.newBadge ? "MISSION COMPLETE • BADGE EARNED" : "MISSION COMPLETE • ALREADY COLLECTED") +
                "</div>" +
                "<div class=\"bd-img\">" + badgeImg(mission, mission.badge) + "</div>" +
                "<h2>" + esc(mission.badge) + "</h2>" +
                "<p class=\"bd-for\">for finishing " + esc(mission.title) + "</p>" +
                "<div class=\"bd-count\">You have <b>" + owned.length + "</b> of " + ids.length + " badges</div>" +
                "<div class=\"bd-row\">" + slots + "</div>" +
                "<div class=\"bd-actions\">" +
                    "<a class=\"bd-map\" href=\"" + esc(ROOT + "map.html#badges") + "\">SEE ALL ON THE MAP</a>" +
                    "<button type=\"button\" class=\"bd-ok\">AWESOME!</button>" +
                "</div>" +
            "</div>";

        root.querySelector(".bd-ok").addEventListener("click", close);

        root.addEventListener("click", function (event) {
            if (event.target === root) {
                close();
            }
        });

        doc.body.appendChild(root);

        global.addEventListener("keydown", onKey, true);
        global.addEventListener("keyup", onKey, true);

        if (global.HackoAudio) {
            global.HackoAudio.play(detail.newBadge ? "unlock" : "win");
        }

        root.querySelector(".bd-ok").focus();
    }

    global.addEventListener("hacko:missioncomplete", function (event) {

        var detail = event.detail || {};

        global.setTimeout(function () {
            try {
                show(detail);
            } catch (e) {
                /* never let the pop-up break the game */
            }
        }, DELAY);
    });

    global.HackoBadges = { show: show, close: close };

}(window));
