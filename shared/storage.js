/* =========================================================
   HACKO - shared/storage.js
   Accounts, progress and autosave for every mission.

   Replaces the 13 incompatible localStorage keys the games
   used to invent for themselves. Everything lives under:

       hacko:users        -> ["maria", "jun"]
       hacko:active       -> "maria"
       hacko:user:maria   -> the progress record

   This project is deliberately offline-only: progress lives
   in ONE browser on ONE machine. exportToFile()/importFile()
   are how a student moves between machines or recovers from
   a wiped lab PC.
========================================================= */

(function (global) {
    "use strict";

    var USERS_KEY = "hacko:users";
    var ACTIVE_KEY = "hacko:active";
    var USER_PREFIX = "hacko:user:";

    /* Fraction of a mission that must be cleared before the
       NEXT mission unlocks. The badge still needs 100%. */
    var UNLOCK_THRESHOLD = 0.7;

    var DEFAULT_TOTAL_LEVELS = 10;
    var DEFAULT_LIVES = 3;

    /* Where the site root is, worked out from this script's own
       address ("shared/storage.js" or "../shared/storage.js"),
       so pages in a sub-folder such as aa/ find skins/ too. */
    var SITE_ROOT = (function () {
        var own = global.document && global.document.currentScript;
        var src = own ? own.getAttribute("src") || "" : "";
        var cut = src.indexOf("shared/storage.js");
        return cut > 0 ? src.slice(0, cut) : "";
    }());

    /* the coin shop catalogue - see COIN SHOP below */
    var SHOP_SLOTS = {
        hacko: { title: "Hacko colours", note: "Hacko wears this in every game." },
        theme: { title: "Map themes", note: "Changes the mission map's sky." }
    };

    var SHOP_ITEMS = [
        { id: "hacko-classic", slot: "hacko", name: "Classic Blue", price: 0,    file: "hacko.png" },
        { id: "hacko-crimson", slot: "hacko", name: "Crimson",      price: 300,  file: "skins/hacko-crimson.png" },
        { id: "hacko-emerald", slot: "hacko", name: "Emerald",      price: 300,  file: "skins/hacko-emerald.png" },
        { id: "hacko-violet",  slot: "hacko", name: "Violet",       price: 500,  file: "skins/hacko-violet.png" },
        { id: "hacko-frost",   slot: "hacko", name: "Frost",        price: 800,  file: "skins/hacko-frost.png" },
        { id: "hacko-shadow",  slot: "hacko", name: "Shadow",       price: 1200, file: "skins/hacko-shadow.png" },
        { id: "hacko-gold",    slot: "hacko", name: "Legend Gold",  price: 2000, file: "skins/hacko-gold.png" },

        { id: "theme-classic",  slot: "theme", name: "Mountain Day",   price: 0,    swatch: ["#7fa8c4", "#728c72"] },
        { id: "theme-midnight", slot: "theme", name: "Midnight",       price: 400,  swatch: ["#0b1a3a", "#1d3557"] },
        { id: "theme-sunset",   slot: "theme", name: "Sunset",         price: 600,  swatch: ["#f4a261", "#7b3f61"] },
        { id: "theme-sakura",   slot: "theme", name: "Cherry Blossom", price: 800,  swatch: ["#ffc8dd", "#a26b8f"] },
        { id: "theme-neon",     slot: "theme", name: "Neon Grid",      price: 1200, swatch: ["#2b0a4a", "#00e5ff"] }
    ];

    var MISSIONS = {
        1:  { title: "The Escape Room",          file: "theescaperoom.html",        badge: "VARIABLE HERO", image: "variablehero.png" },
        2:  { title: "The Secret Message",       file: "thesecretmessage.html",     badge: "CODE MESSENGER", image: "codemessenger.png" },
        3:  { title: "Conditional Challenge",    file: "conditionalchallenge.html", badge: "DECISION MASTER", image: "decisionmaster.png" },
        4:  { title: "Loop Labyrinth",           file: "looplabyrinth.html",        badge: "LOOP RUNNER", image: "looprunner.png" },
        5:  { title: "Array Adventure",          file: "arrayadventure.html",       badge: "ARRAY EXPLORER", image: "arrayexplorer.png" },
        6:  { title: "Function Fortress",        file: "functionfortress.html",     badge: "FUNCTION KNIGHT", image: "functionknight.png" },
        7:  { title: "Debugging Duel",           file: "",                          badge: "BUG SLAYER", image: "bugslayer.png" },
        8:  { title: "Classroom Rescue",         file: "classroomrescue.html",      badge: "OBJECT HERO", image: "objecthero.png" },
        9:  { title: "Conditional Labyrinth II", file: "",                          badge: "LOGIC MASTER", image: "LOGICMASTER.png" },
        10: { title: "Loop Boss Battle",         file: "loopboss.html",             badge: "LOOP LEGEND", image: "LOOPLEGEND.png" }
    };


    /* ---------------------------------------------------
       RAW STORAGE (never throws)
    --------------------------------------------------- */

    function read(key) {
        try {
            return global.localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function write(key, value) {
        try {
            global.localStorage.setItem(key, value);
            return true;
        } catch (e) {
            return false;
        }
    }

    function remove(key) {
        try {
            global.localStorage.removeItem(key);
        } catch (e) {
            /* ignore */
        }
    }

    function readJSON(key, fallback) {

        var raw = read(key);

        if (!raw) {
            return fallback;
        }

        try {
            var parsed = JSON.parse(raw);
            return parsed === null ? fallback : parsed;
        } catch (e) {
            return fallback;
        }
    }


    /* ---------------------------------------------------
       RECORD SHAPE
    --------------------------------------------------- */

    function blankMission() {
        return {
            levelsDone: [],
            xpPaid: [],
            resumeLevel: 0,
            lives: DEFAULT_LIVES,
            bestXP: 0,
            totalLevels: DEFAULT_TOTAL_LEVELS,
            completed: false,
            badge: false
        };
    }

    function blankRecord(username) {
        return {
            username: username,
            createdAt: new Date().toISOString(),
            totalXP: 0,
            currentMission: 1,
            missions: {},
            badges: [],
            hintSpent: 0,
            hintsBought: {},
            coinsSpent: 0,
            owned: [],
            equipped: { hacko: "hacko-classic", theme: "theme-classic" },
            playSeconds: 0,
            settings: { muted: false }
        };
    }

    /* Fills in anything an older or partial record is missing. */
    function normalise(record, username) {

        var safe = blankRecord(username);

        if (!record || typeof record !== "object") {
            return safe;
        }

        safe.username = record.username || username;
        safe.createdAt = record.createdAt || safe.createdAt;
        safe.totalXP = Number(record.totalXP) || 0;
        safe.currentMission = Number(record.currentMission) || 1;
        safe.badges = Array.isArray(record.badges) ? record.badges : [];
        safe.hintSpent = Math.max(0, Number(record.hintSpent) || 0);
        safe.playSeconds = Math.max(0, Math.floor(Number(record.playSeconds) || 0));

        if (typeof record.certifiedAt === "string") {
            safe.certifiedAt = record.certifiedAt;
        }

        if (typeof record.certifiedPlaySeconds === "number") {
            safe.certifiedPlaySeconds = Math.max(0, Math.floor(record.certifiedPlaySeconds));
        }

        safe.hintsBought = {};

        if (record.hintsBought && typeof record.hintsBought === "object") {
            Object.keys(record.hintsBought).forEach(function (id) {
                var n = Number(record.hintsBought[id]) || 0;
                if (n > 0) {
                    safe.hintsBought[id] = n;
                }
            });
        }

        safe.settings = {
            muted: !!(record.settings && record.settings.muted)
        };

        /* shop: only items that still exist in the catalogue */
        safe.coinsSpent = Math.max(0, Number(record.coinsSpent) || 0);
        safe.owned = (Array.isArray(record.owned) ? record.owned : [])
            .filter(function (id, i, all) {
                return shopItem(id) && all.indexOf(id) === i;
            });

        var eq = record.equipped || {};

        Object.keys(SHOP_SLOTS).forEach(function (slot) {
            var it = shopItem(eq[slot]);
            if (it && it.slot === slot) {
                safe.equipped[slot] = it.id;
            }
        });

        var missions = record.missions || {};

        Object.keys(missions).forEach(function (id) {

            var src = missions[id] || {};
            var dst = blankMission();

            dst.levelsDone = Array.isArray(src.levelsDone)
                ? src.levelsDone.slice()
                : [];

            /* records from before xpPaid existed paid for what they cleared */
            dst.xpPaid = Array.isArray(src.xpPaid)
                ? src.xpPaid.slice()
                : dst.levelsDone.slice();

            dst.resumeLevel = Number(src.resumeLevel) || 0;
            dst.lives = Number(src.lives) || DEFAULT_LIVES;
            dst.bestXP = Number(src.bestXP) || 0;
            dst.totalLevels = Number(src.totalLevels) || DEFAULT_TOTAL_LEVELS;
            dst.completed = !!src.completed;
            dst.badge = !!src.badge;

            safe.missions[id] = dst;
        });

        return safe;
    }


    /* ---------------------------------------------------
       ACCOUNTS
    --------------------------------------------------- */

    function listUsers() {
        var users = readJSON(USERS_KEY, []);
        return Array.isArray(users) ? users : [];
    }

    function saveUsers(users) {
        write(USERS_KEY, JSON.stringify(users));
    }

    function activeUser() {
        return read(ACTIVE_KEY) || null;
    }

    function userKey(name) {
        return USER_PREFIX + name;
    }

    /* Signs in, creating the profile if this name is new.
       There is no password check - this is a classroom name
       picker on a shared machine, NOT authentication. */
    function login(name) {

        var clean = String(name || "").trim();

        if (!clean) {
            return null;
        }

        var users = listUsers();

        if (users.indexOf(clean) === -1) {
            users.push(clean);
            saveUsers(users);
            write(userKey(clean), JSON.stringify(blankRecord(clean)));
        }

        switchLegacyTo(clean);
        write(ACTIVE_KEY, clean);
        migrateLegacy();

        return load();
    }

    function logout() {

        var name = activeUser();

        if (name) {
            stashLegacy(name);
        }

        remove(ACTIVE_KEY);
    }

    function isLoggedIn() {
        return !!activeUser();
    }

    function deleteUser(name) {

        var users = listUsers().filter(function (u) {
            return u !== name;
        });

        saveUsers(users);
        remove(userKey(name));

        if (activeUser() === name) {
            remove(ACTIVE_KEY);
            clearLegacy();
        }

        remove(LEGACY_STASH_PREFIX + name);
    }


    /* ---------------------------------------------------
       LOAD / SAVE
    --------------------------------------------------- */

    function load() {

        var name = activeUser();

        if (!name) {
            return null;
        }

        return normalise(readJSON(userKey(name), null), name);
    }

    function save(record) {

        var name = activeUser();

        if (!name || !record) {
            return false;
        }

        record.username = name;

        return write(userKey(name), JSON.stringify(record));
    }

    /* Read-modify-write helper so callers never race. */
    function update(fn) {

        var record = load();

        if (!record) {
            return null;
        }

        fn(record);
        save(record);

        return record;
    }


    /* ---------------------------------------------------
       MISSION PROGRESS
    --------------------------------------------------- */

    function mission(id) {

        var record = load();

        if (!record) {
            return blankMission();
        }

        return record.missions[String(id)] || blankMission();
    }

    function totalLevels(id) {
        return mission(id).totalLevels || DEFAULT_TOTAL_LEVELS;
    }

    /* Each game declares its real level count on load, so the
       threshold stays correct even if a game gains levels. */
    function registerTotalLevels(id, count) {

        var n = Number(count);

        if (!n || n < 1) {
            return;
        }

        update(function (record) {
            var key = String(id);
            record.missions[key] = record.missions[key] || blankMission();
            record.missions[key].totalLevels = n;
        });
    }

    /* Unlock check against an in-memory record. Used inside
       update(), where load() would read stale data. */
    function isUnlockedIn(record, id) {

        if (id <= 1) {
            return true;
        }

        var prev = record.missions[String(id - 1)];

        if (!prev) {
            return false;
        }

        var total = prev.totalLevels || DEFAULT_TOTAL_LEVELS;

        return prev.levelsDone.length >= Math.ceil(total * UNLOCK_THRESHOLD);
    }

    /* ---------------------------------------------------
       TEST MODE

       Opens every mission so a game can be checked without
       playing through the ones before it. Kept out of the
       progress record on purpose - it is a property of this
       browser, not of the student.
    --------------------------------------------------- */

    var TEST_KEY = "hacko:testmode";

    function isTestMode() {
        return read(TEST_KEY) === "true";
    }

    function setTestMode(on) {
        write(TEST_KEY, String(!!on));
        return isTestMode();
    }

    /* ?unlock in the address bar turns it on for this browser */
    (function readTestFlagFromUrl() {

        if (!global.location) {
            return;
        }

        var query = global.location.search || "";

        if (/[?&]unlock/.test(query)) {
            setTestMode(true);
        } else if (/[?&]lock/.test(query)) {
            setTestMode(false);
        }
    }());


    /* Mission 1 is always open. Every other mission needs
       UNLOCK_THRESHOLD of the previous one. */
    function isUnlocked(id) {

        if (isTestMode()) {
            return true;
        }

        var record = load();

        if (!record) {
            return Number(id) <= 1;
        }

        return isUnlockedIn(record, Number(id));
    }

    function completeLevel(id, levelIndex, xp) {

        var key = String(id);
        var index = Number(levelIndex);
        var gained = Number(xp) || 0;
        var newBadge = false;
        var finished = false;

        /* Test mode opens missions the student never earned, so
           nothing played in it counts - no levels, XP, badges or
           certificate. Only the resume point moves, so a tester
           who reloads lands back where they were checking. */
        if (isTestMode()) {
            return setResumeLevel(id, Math.min(index + 1, totalLevels(id) - 1));
        }

        var result = update(function (record) {

            var m = record.missions[key] || blankMission();

            markPaid(m);

            if (m.levelsDone.indexOf(index) === -1) {
                m.levelsDone.push(index);
                m.levelsDone.sort(function (a, b) { return a - b; });
            }

            /* a level re-cleared after losing all lives pays nothing */
            if (m.xpPaid.indexOf(index) === -1) {
                m.xpPaid.push(index);
                record.totalXP += gained;
            }

            m.bestXP = Math.max(m.bestXP, gained);
            m.resumeLevel = Math.min(index + 1, m.totalLevels - 1);
            m.completed = m.levelsDone.length >= m.totalLevels;

            /* The badge is 100% only - clearing the 70% gate
               is not enough to earn it. */
            if (m.completed && !m.badge) {

                m.badge = true;
                newBadge = true;

                var badgeName = MISSIONS[key] && MISSIONS[key].badge;

                if (badgeName && record.badges.indexOf(badgeName) === -1) {
                    record.badges.push(badgeName);
                }
            }

            /* the end of the game: the badge was just earned, or a
               finished mission's last level was cleared again */
            finished = m.completed &&
                (newBadge || index === m.totalLevels - 1);

            record.missions[key] = m;

            /* the day the whole course was finished, and how long
               it took, go on the certificate - the time is frozen
               here so replaying afterwards does not add to it */
            if (!record.certifiedAt && allCompleteIn(record)) {
                record.certifiedAt = new Date().toISOString();
                record.certifiedPlaySeconds = record.playSeconds;
            }

            var next = Number(id) + 1;

            if (next <= 10 && isUnlockedIn(record, next)) {
                record.currentMission = Math.max(record.currentMission, next);
            }
        });

        /* shared/badges.js listens for this and shows the badge */
        if (result && finished) {
            announce("hacko:missioncomplete", {
                mission: Number(id),
                badge: MISSIONS[key] && MISSIONS[key].badge,
                newBadge: newBadge,
                badges: result.badges.slice()
            });
        }

        return result;
    }

    /* ---------------------------------------------------
       CERTIFICATE
       Earned by completing every level of all ten missions -
       the same 100% that earns each badge, so the certificate
       and a full badge collection always agree.
    --------------------------------------------------- */

    function allCompleteIn(record) {

        return Object.keys(MISSIONS).every(function (id) {
            var m = record.missions[id];
            return !!(m && m.completed);
        });
    }

    function hasCertificate() {

        var record = load();

        return !!record && isCertifiedIn(record);
    }

    /* Once earned it is kept, even if losing all lives later
       un-clears a level of a finished mission. */
    function isCertifiedIn(record) {
        return !!record.certifiedAt || allCompleteIn(record);
    }

    /* Details to print, or null if not earned yet. A player
       who finished before certificates (or the finishing time)
       existed gets today's date and play time the first time
       they open it, and keeps them. */
    function certificate() {

        var record = load();

        if (!record || !isCertifiedIn(record)) {
            return null;
        }

        var missing = false;

        if (!record.certifiedAt) {
            record.certifiedAt = new Date().toISOString();
            missing = true;
        }

        if (typeof record.certifiedPlaySeconds !== "number") {
            record.certifiedPlaySeconds = record.playSeconds;
            missing = true;
        }

        if (missing) {
            save(record);
        }

        return {
            username: record.username,
            date: record.certifiedAt,
            playSeconds: record.certifiedPlaySeconds,
            badges: record.badges.slice()
        };
    }

    function announce(name, detail) {

        if (!global.dispatchEvent || typeof global.CustomEvent !== "function") {
            return;
        }

        try {
            global.dispatchEvent(new global.CustomEvent(name, { detail: detail }));
        } catch (e) {
            /* a listener failing must never break saving */
        }
    }

    /* ---------------------------------------------------
       HINT POINTS

       The client asked for hints to be bought with points
       earned in the game, and for the points to stay small.

         - every player starts with HINT_START points, so a
           student stuck on their very first level can still
           get help
         - each level cleared for the first time in a game
           that sells hints earns one point
         - each hint costs HINT_COST; a hint already bought
           stays free to read again

       Kept apart from totalXP on purpose: the map shows XP
       as the player's score, and buying help should never
       lower it. Earned points are derived from levelsDone
       rather than stored, so existing players get the points
       for levels they had already cleared.
    --------------------------------------------------- */

    var HINT_MISSIONS = [4, 8, 9, 10];
    var HINT_START = 3;
    var HINT_COST = 1;

    function hintEarnedIn(record) {

        return HINT_MISSIONS.reduce(function (total, id) {
            var m = record.missions[String(id)];
            return total + (m ? m.levelsDone.length : 0);
        }, HINT_START);
    }

    function hintBalanceIn(record) {
        return Math.max(0, hintEarnedIn(record) - record.hintSpent);
    }

    function hintBalance() {

        var record = load();

        return record ? hintBalanceIn(record) : HINT_START;
    }

    /* how many tiers of this puzzle's hints are already paid for */
    function hintsOwned(puzzleId) {

        var record = load();

        return record ? (record.hintsBought[String(puzzleId)] || 0) : 0;
    }

    /* Pays for tier `tier` (0-based) of a puzzle's hints.
       Tiers are bought in order, and one already owned is
       free. Returns { ok, charged, balance }. */
    function buyHint(puzzleId, tier) {

        var key = String(puzzleId);
        var index = Number(tier) || 0;
        var outcome = { ok: false, charged: false, balance: 0 };

        var result = update(function (record) {

            var owned = record.hintsBought[key] || 0;

            if (index < owned) {
                outcome.ok = true;
            } else if (hintBalanceIn(record) >= HINT_COST) {
                record.hintSpent += HINT_COST;
                record.hintsBought[key] = index + 1;
                outcome.ok = true;
                outcome.charged = true;
            }

            outcome.balance = hintBalanceIn(record);
        });

        /* no signed-in player (a game opened on its own):
           hints stay free rather than locking the player out */
        if (!result) {
            return { ok: true, charged: false, balance: HINT_START };
        }

        if (outcome.charged) {
            announce("hacko:hintpoints", { balance: outcome.balance });
        }

        return outcome;
    }

    /* ---------------------------------------------------
       COIN SHOP

       The client wanted the points to be worth something
       without letting a student buy their way past the Java.
       So coins buy LOOKS ONLY - a colour for Hacko in every
       game and a theme for the mission map. Nothing here
       changes lives, hints, unlocking, badges or the
       certificate.

         - coins earned = totalXP (what clearing levels pays:
           100 a level, more in Classroom Rescue), so players
           who already had progress start with coins
         - coins spent are tracked apart, so spending never
           lowers anything else
         - test mode lets a tester try every item for free and
           keeps the try-on out of the student's record
    --------------------------------------------------- */

    var TRYON_KEY = "hacko:tryon";

    function shopItem(id) {
        for (var i = 0; i < SHOP_ITEMS.length; i++) {
            if (SHOP_ITEMS[i].id === id) {
                return SHOP_ITEMS[i];
            }
        }
        return null;
    }

    function coinBalanceIn(record) {
        return Math.max(0, (Number(record.totalXP) || 0) - record.coinsSpent);
    }

    function coinBalance() {
        var record = load();
        return record ? coinBalanceIn(record) : 0;
    }

    function ownsIn(record, it) {
        return it.price === 0 || record.owned.indexOf(it.id) !== -1;
    }

    function ownsItem(id) {
        var it = shopItem(id);
        var record = load();
        if (!it) {
            return false;
        }
        if (isTestMode()) {
            return true;
        }
        return record ? ownsIn(record, it) : it.price === 0;
    }

    /* Returns { ok, reason, balance }. reason: "owned",
       "coins" (not enough), "missing" (no such item or no
       player signed in). Buying also puts the item on. */
    function buyItem(id) {

        var it = shopItem(id);
        var outcome = { ok: false, reason: "missing", balance: 0 };

        if (!it) {
            return outcome;
        }

        if (isTestMode()) {
            equipItem(id);
            return { ok: true, reason: "test", balance: coinBalance() };
        }

        update(function (record) {

            if (ownsIn(record, it)) {
                outcome.reason = "owned";
            } else if (coinBalanceIn(record) < it.price) {
                outcome.reason = "coins";
            } else {
                record.coinsSpent += it.price;
                record.owned.push(it.id);
                record.equipped[it.slot] = it.id;
                outcome.ok = true;
                outcome.reason = "bought";
            }

            outcome.balance = coinBalanceIn(record);
        });

        if (outcome.ok) {
            announce("hacko:shop", { item: it.id, balance: outcome.balance });
        }

        return outcome;
    }

    function equipItem(id) {

        var it = shopItem(id);

        if (!it) {
            return false;
        }

        if (isTestMode()) {
            var tryon = readJSON(TRYON_KEY, {}) || {};
            tryon[it.slot] = it.id;
            write(TRYON_KEY, JSON.stringify(tryon));
            announce("hacko:shop", { item: it.id });
            return true;
        }

        var done = false;

        update(function (record) {
            if (ownsIn(record, it)) {
                record.equipped[it.slot] = it.id;
                done = true;
            }
        });

        if (done) {
            announce("hacko:shop", { item: it.id });
        }

        return done;
    }

    /* the item id worn in a slot ("hacko" or "theme") */
    function equipped(slot) {

        var fallback = slot === "theme" ? "theme-classic" : "hacko-classic";

        if (isTestMode()) {
            var tryon = readJSON(TRYON_KEY, {}) || {};
            var t = shopItem(tryon[slot]);
            if (t && t.slot === slot) {
                return t.id;
            }
        }

        var record = load();

        return (record && record.equipped[slot]) || fallback;
    }

    /* The picture every game should draw Hacko with. */
    function hackoSrc() {
        var it = shopItem(equipped("hacko")) || shopItem("hacko-classic");
        return SITE_ROOT + it.file;
    }

    function shopFileUrl(id) {
        var it = shopItem(id);
        return it && it.file ? SITE_ROOT + it.file : "";
    }

    function setResumeLevel(id, levelIndex) {

        var key = String(id);

        return update(function (record) {
            record.missions[key] = record.missions[key] || blankMission();
            record.missions[key].resumeLevel = Number(levelIndex) || 0;
        });
    }

    function getResumeLevel(id) {
        return mission(id).resumeLevel || 0;
    }

    /* The client's rule: every mission has three lives, and
       running out drops the player back ONE level rather than
       restarting the mission or silently resetting.

       The panel added: the level they drop back to has to be
       cleared again before anything after it opens - die on
       level 9 and level 9 stays locked until level 8 is beaten
       again. So everything from that level on is un-cleared.
       That can take a mission back under the 70% gate and lock
       the next one again; that is intended. XP is not paid a
       second time (xpPaid remembers), and a badge or
       certificate already earned is kept.

       Returns the level they should land on. */
    function loseAllLives(id, currentLevel) {

        var key = String(id);
        var back = Math.max(0, Number(currentLevel) - 1);

        update(function (record) {

            var m = record.missions[key] || blankMission();

            /* test mode keeps its hands off a student's real record */
            if (!isTestMode()) {
                markPaid(m);
                m.levelsDone = m.levelsDone.filter(function (i) { return i < back; });
                m.completed = m.levelsDone.length >= m.totalLevels;
            }

            m.lives = DEFAULT_LIVES;
            m.resumeLevel = back;

            record.missions[key] = m;
        });

        return back;
    }

    /* every level ever cleared has paid its XP */
    function markPaid(m) {
        m.levelsDone.forEach(function (i) {
            if (m.xpPaid.indexOf(i) === -1) {
                m.xpPaid.push(i);
            }
        });
    }

    /* Level N opens once level N-1 is cleared. Every game's level
       select asks here, so a level locked by loseAllLives is
       locked the same way in all ten games. */
    function isLevelOpen(id, levelIndex) {

        var index = Number(levelIndex);

        if (index <= 0 || isTestMode()) {
            return true;
        }

        return isLevelDone(id, index - 1);
    }

    function isLevelDone(id, levelIndex) {
        return mission(id).levelsDone.indexOf(Number(levelIndex)) !== -1;
    }


    /* ---------------------------------------------------
       AUTOSAVE

       Games used to save only on level completion, so
       leaving mid-level lost the work. pagehide and
       visibilitychange are both bound because beforeunload
       is unreliable on mobile.
    --------------------------------------------------- */

    function bindAutosave(getState) {

        function flush() {

            var state = getState && getState();

            if (!state || typeof state.mission === "undefined") {
                return;
            }

            var key = String(state.mission);

            update(function (record) {

                var m = record.missions[key] || blankMission();

                if (typeof state.level === "number") {
                    m.resumeLevel = state.level;
                }

                if (typeof state.lives === "number") {
                    m.lives = state.lives;
                }

                record.missions[key] = m;
            });
        }

        global.addEventListener("pagehide", flush);

        global.addEventListener("visibilitychange", function () {
            if (global.document.visibilityState === "hidden") {
                flush();
            }
        });

        return flush;
    }


    /* ---------------------------------------------------
       PLAY TIME

       The client asked for the map to show time spent
       playing instead of lives. Time counts only on game
       pages (not the map, sign-in or certificate), only
       while the tab is visible, and only while the player
       has touched a key, mouse or screen in the last
       IDLE_LIMIT seconds - a game left open over lunch
       should not add an hour.
    --------------------------------------------------- */

    var PLAY_TICK_MS = 15000;
    var IDLE_LIMIT_MS = 120000;

    var HUB_PAGES = [
        "", "index.html", "login.html", "map.html",
        "certificate.html"
    ];

    function playSeconds() {

        var record = load();

        return record ? record.playSeconds : 0;
    }

    /* "45s", "12m", "1h 05m" */
    function formatPlayTime(seconds) {

        var s = Math.max(0, Math.floor(Number(seconds) || 0));
        var h = Math.floor(s / 3600);
        var m = Math.floor((s % 3600) / 60);

        if (h > 0) {
            return h + "h " + (m < 10 ? "0" : "") + m + "m";
        }

        if (m > 0) {
            return m + "m";
        }

        return s + "s";
    }

    function startPlayClock() {

        var doc = global.document;
        var lastInput = Date.now();
        var lastCount = Date.now();
        var visible = doc.visibilityState !== "hidden";

        function onInput() {
            lastInput = Date.now();
        }

        /* adds the time since the last count, capped at the idle
           limit so a sleeping laptop cannot add hours on wake */
        function count() {

            var now = Date.now();
            var since = now - lastCount;

            lastCount = now;

            if (!visible || !isLoggedIn()) {
                return;
            }

            if (now - lastInput > IDLE_LIMIT_MS) {
                return;
            }

            var seconds = Math.floor(Math.min(since, IDLE_LIMIT_MS) / 1000);

            if (seconds <= 0) {
                return;
            }

            update(function (record) {
                record.playSeconds += seconds;
            });
        }

        ["keydown", "pointerdown", "pointermove", "touchstart", "wheel"]
            .forEach(function (name) {
                global.addEventListener(name, onInput, { passive: true, capture: true });
            });

        global.setInterval(count, PLAY_TICK_MS);

        global.addEventListener("pagehide", count);

        doc.addEventListener("visibilitychange", function () {

            if (doc.visibilityState === "hidden") {
                count();
                visible = false;
            } else {
                /* time away from the tab is not play time */
                visible = true;
                lastCount = Date.now();
                lastInput = Date.now();
            }
        });
    }


    /* ---------------------------------------------------
       EXPORT / IMPORT
       The only way to move progress between machines in an
       offline-only build.
    --------------------------------------------------- */

    /* Pass a name to download that player's file. Without one
       it falls back to whoever signed in last - which on a
       shared lab PC was easily a classmate, so the sign-in
       page always names the player. */
    function exportToFile(name) {

        var record = name
            ? (listUsers().indexOf(name) !== -1
                ? normalise(readJSON(userKey(name), null), name)
                : null)
            : load();

        if (!record) {
            return false;
        }

        var payload = {
            hackoExport: 1,
            exportedAt: new Date().toISOString(),
            record: record
        };

        var blob = new global.Blob(
            [JSON.stringify(payload, null, 2)],
            { type: "application/json" }
        );

        var url = global.URL.createObjectURL(blob);
        var link = global.document.createElement("a");

        link.href = url;
        link.download =
            "hacko-progress-" +
            record.username.replace(/[^a-z0-9]/gi, "_") +
            ".json";

        global.document.body.appendChild(link);
        link.click();
        global.document.body.removeChild(link);
        global.URL.revokeObjectURL(url);

        return true;
    }

    /* Validates before overwriting - a malformed file must
       never corrupt a working profile. */
    function validateExport(payload) {

        if (!payload || typeof payload !== "object") {
            return "That file is not a HACKO progress file.";
        }

        if (payload.hackoExport !== 1) {
            return "That file is not a HACKO progress file.";
        }

        var record = payload.record;

        if (!record || typeof record !== "object") {
            return "The progress file is missing its data.";
        }

        if (typeof record.username !== "string" || !record.username.trim()) {
            return "The progress file has no username.";
        }

        if (!record.missions || typeof record.missions !== "object") {
            return "The progress file has no mission data.";
        }

        return null;
    }

    function importFile(file) {

        return new Promise(function (resolve, reject) {

            var reader = new global.FileReader();

            reader.onerror = function () {
                reject(new Error("Could not read that file."));
            };

            reader.onload = function () {

                var payload;

                try {
                    payload = JSON.parse(reader.result);
                } catch (e) {
                    reject(new Error("That file is not valid JSON."));
                    return;
                }

                var problem = validateExport(payload);

                if (problem) {
                    reject(new Error(problem));
                    return;
                }

                var name = payload.record.username.trim();
                var users = listUsers();

                if (users.indexOf(name) === -1) {
                    users.push(name);
                    saveUsers(users);
                }

                write(
                    userKey(name),
                    JSON.stringify(normalise(payload.record, name))
                );

                switchLegacyTo(name);
                write(ACTIVE_KEY, name);

                resolve(load());
            };

            reader.readAsText(file);
        });
    }


    /* ---------------------------------------------------
       SETTINGS
    --------------------------------------------------- */

    function isMuted() {

        var record = load();

        return record ? !!record.settings.muted : false;
    }

    function setMuted(value) {

        update(function (record) {
            record.settings.muted = !!value;
        });

        if (global.HackoAudio) {
            global.HackoAudio.setMuted(value);
        }
    }


    /* ---------------------------------------------------
       LEGACY MIGRATION
       Folds the old per-game keys into the active profile
       once, so existing testers keep their progress.
    --------------------------------------------------- */

    var LEGACY_LEVEL_KEYS = {
        "hackoSecretMessageProgress":  { mission: 2, field: "completedLevels" },
        "hackoPacConditionalProgress": { mission: 3, field: "completedLevels" },
        "hackoLoopProgress":           { mission: 4, field: "completed" },
        "hackoArrayProgress":          { mission: 5, field: "done" },
        "hackoFunctionProgress":       { mission: 6, field: "done" }
    };

    /* The games still read and write these old keys for their
       own level-select screens, so they are NOT a one-off
       leftover: whoever played last leaves their progress in
       them. They used to be folded into every new profile,
       which handed a brand-new player someone else's missions.
       Now the migration runs once per browser, and the keys
       are swapped per player (stashed on sign-out, restored on
       sign-in) so no player ever sees another's progress. */
    var LEGACY_KEYS = Object.keys(LEGACY_LEVEL_KEYS).concat([
        "hackoProgress",
        "hackoGameState",
        "classroomRescue"
    ]);

    var LEGACY_STASH_PREFIX = "hacko:legacy:";

    /* Global, not per player: it must survive every profile
       being deleted, or the next new player re-imports. */
    var MIGRATED_FLAG = "hacko:migrated";

    function storageKeys() {

        var keys = [];

        try {
            var ls = global.localStorage;

            for (var i = 0; i < ls.length; i++) {
                keys.push(ls.key(i));
            }
        } catch (e) {
            /* ignore */
        }

        return keys;
    }

    /* Older builds set "hacko:migrated:<name>" per player, so
       a browser that has any of those has already migrated. */
    function legacyMigrated() {

        if (read(MIGRATED_FLAG) === "true") {
            return true;
        }

        return storageKeys().some(function (k) {
            return k && k.indexOf(MIGRATED_FLAG + ":") === 0;
        });
    }

    function stashLegacy(name) {

        var bag = {};

        LEGACY_KEYS.forEach(function (key) {

            var value = read(key);

            if (value !== null) {
                bag[key] = value;
            }
        });

        write(LEGACY_STASH_PREFIX + name, JSON.stringify(bag));
    }

    function clearLegacy() {
        LEGACY_KEYS.forEach(remove);
    }

    function restoreLegacy(name) {

        var bag = readJSON(LEGACY_STASH_PREFIX + name, {});

        LEGACY_KEYS.forEach(function (key) {

            if (typeof bag[key] === "string") {
                write(key, bag[key]);
            } else {
                remove(key);
            }
        });
    }

    /* Puts the old keys back the way `name` left them. Before
       the one-time migration they belong to whoever played
       before accounts existed, so they are left for it. */
    function switchLegacyTo(name) {

        var current = activeUser();

        if (current === name) {
            return;
        }

        if (current) {
            stashLegacy(current);
        }

        if (legacyMigrated()) {
            restoreLegacy(name);
        }
    }

    function migrateLegacy() {

        var name = activeUser();

        if (!name || legacyMigrated()) {
            return;
        }

        var record = load();

        if (!record) {
            return;
        }

        /* per-game level lists */
        Object.keys(LEGACY_LEVEL_KEYS).forEach(function (key) {

            var spec = LEGACY_LEVEL_KEYS[key];
            var old = readJSON(key, null);

            if (!old) {
                return;
            }

            var levels = old[spec.field];

            if (!Array.isArray(levels) || !levels.length) {
                return;
            }

            var m = record.missions[String(spec.mission)] || blankMission();

            levels.forEach(function (lv) {

                var n = Number(lv);

                if (!isNaN(n) && m.levelsDone.indexOf(n) === -1) {
                    m.levelsDone.push(n);
                }
            });

            m.levelsDone.sort(function (a, b) { return a - b; });
            m.completed = m.levelsDone.length >= m.totalLevels;

            record.missions[String(spec.mission)] = m;
        });

        /* whole-mission completion lists from the two old hubs */
        [
            readJSON("hackoProgress", {}).completedMissions,
            readJSON("hackoGameState", {}).completed
        ].forEach(function (list) {

            if (!Array.isArray(list)) {
                return;
            }

            list.forEach(function (id) {

                var key = String(id);
                var m = record.missions[key] || blankMission();

                /* an old "mission complete" means every level */
                if (m.levelsDone.length < m.totalLevels) {

                    m.levelsDone = [];

                    for (var i = 0; i < m.totalLevels; i++) {
                        m.levelsDone.push(i);
                    }
                }

                m.completed = true;
                m.badge = true;

                var badgeName = MISSIONS[key] && MISSIONS[key].badge;

                if (badgeName && record.badges.indexOf(badgeName) === -1) {
                    record.badges.push(badgeName);
                }

                record.missions[key] = m;
            });
        });

        var oldXP = readJSON("hackoProgress", {}).totalXP;

        if (oldXP) {
            record.totalXP = Math.max(record.totalXP, Number(oldXP) || 0);
        }

        save(record);
        write(MIGRATED_FLAG, "true");
    }


    /* ---------------------------------------------------
       NAVIGATION

       No game had a way back to the mission map - the only
       route out was the browser Back button, so a player who
       cleared enough levels to unlock the next mission had no
       visible way to go and start it.
    --------------------------------------------------- */

    /* aa/ sits one folder down, so links to the map have to climb out */
    function mapHref() {
        return (global.location && /\/aa\//.test(global.location.pathname))
            ? "../map.html"
            : "map.html";
    }

    function currentPage() {
        return (global.location && global.location.pathname || "")
            .split("/").pop().toLowerCase();
    }

    function mountMapLink() {

        var doc = global.document;

        if (!doc || doc.getElementById("hacko-map-link")) {
            return null;
        }

        var link = doc.createElement("a");

        link.id = "hacko-map-link";
        link.href = mapHref();

        /* The panel asked for EXIT with an "are you sure" inside a
           game, so a stray click does not end the run. Hub pages
           (certificate) has no run to lose and keeps HOME. */
        var inGame = HUB_PAGES.indexOf(currentPage()) === -1;

        link.textContent = inGame ? "✕ EXIT" : "◀ HOME";

        link.addEventListener("click", function (e) {

            if (global.HackoAudio) {
                global.HackoAudio.play("select");
            }

            if (!inGame) {
                return;
            }

            e.preventDefault();

            /* briefing.js draws the question in the game's style and
               freezes the game while it is up; a game without a
               briefing falls back to the browser's own */
            if (global.HackoBriefing && global.HackoBriefing.confirmExit) {
                global.HackoBriefing.confirmExit(link.href);
            } else if (global.confirm("Are you sure you want to exit?")) {
                global.location.href = link.href;
            }
        });

        /* Sit in whatever stat row the game already has, rather than
           floating over the corner and covering its HUD. Each game
           named its row differently, so try them in turn. */
        var row =
            doc.querySelector(".hk-hud") ||
            doc.querySelector("header .stats") ||
            doc.querySelector("#top .stats") ||
            doc.querySelector("header .hud-grid") ||
            doc.querySelector("header .hud") ||
            doc.querySelector("header .top-actions") ||
            doc.querySelector(".stats") ||
            doc.querySelector("header");

        if (row) {

            link.style.cssText = [
                "display:inline-flex", "align-items:center",
                "border:1px solid #45f3ff", "border-radius:999px",
                "background:rgba(69,243,255,.12)", "color:#45f3ff",
                "cursor:pointer", "padding:7px 14px", "margin-left:8px",
                "text-decoration:none", "white-space:nowrap",
                "font:700 12px Orbitron,sans-serif"
            ].join(";");

            row.appendChild(link);

            return link;
        }

        /* no header to join - fall back to a corner */
        link.style.cssText = [
            "position:fixed", "right:14px", "top:14px", "z-index:9999",
            "border:1px solid #45f3ff", "border-radius:999px",
            "background:#45f3ff", "color:#06111c", "cursor:pointer",
            "padding:9px 16px", "text-decoration:none",
            "font:700 13px Orbitron,sans-serif",
            "box-shadow:0 4px 14px rgba(0,0,0,.45)"
        ].join(";");

        doc.body.appendChild(link);

        return link;
    }

    /* ---------------------------------------------------
       PUBLIC API
    --------------------------------------------------- */

    global.HackoStore = {

        MISSIONS: MISSIONS,

        listUsers: listUsers,
        activeUser: activeUser,
        login: login,
        logout: logout,
        isLoggedIn: isLoggedIn,
        deleteUser: deleteUser,

        load: load,

        mission: mission,
        registerTotalLevels: registerTotalLevels,
        isUnlocked: isUnlocked,
        completeLevel: completeLevel,
        getResumeLevel: getResumeLevel,
        loseAllLives: loseAllLives,
        isLevelOpen: isLevelOpen,
        isLevelDone: isLevelDone,

        HINT_MISSIONS: HINT_MISSIONS,
        hintBalance: hintBalance,
        hintsOwned: hintsOwned,
        buyHint: buyHint,

        SHOP_SLOTS: SHOP_SLOTS,
        SHOP_ITEMS: SHOP_ITEMS,
        shopItem: shopItem,
        shopFileUrl: shopFileUrl,
        coinBalance: coinBalance,
        ownsItem: ownsItem,
        buyItem: buyItem,
        equipItem: equipItem,
        equipped: equipped,
        hackoSrc: hackoSrc,

        hasCertificate: hasCertificate,
        certificate: certificate,

        playSeconds: playSeconds,
        formatPlayTime: formatPlayTime,

        bindAutosave: bindAutosave,

        exportToFile: exportToFile,
        importFile: importFile,

        isMuted: isMuted,
        setMuted: setMuted,

        mapHref: mapHref,
        mountMapLink: mountMapLink,
        isTestMode: isTestMode,
        setTestMode: setTestMode
    };


    /* Pages that show Hacko as an <img> (Classroom Rescue,
       the Debugging Gym) get the equipped colour without any
       game code of their own. Canvas games ask hackoSrc(). */
    (function dressHackoImages() {

        var doc = global.document;

        if (!doc) {
            return;
        }

        function dress() {
            var src = hackoSrc();
            if (/(^|\/)hacko\.png$/.test(src)) {
                return;
            }
            var imgs = doc.querySelectorAll("img");
            for (var i = 0; i < imgs.length; i++) {
                if (/(^|\/)hacko\.png$/.test(imgs[i].getAttribute("src") || "")) {
                    imgs[i].setAttribute("src", src);
                }
            }
        }

        if (doc.readyState === "loading") {
            doc.addEventListener("DOMContentLoaded", dress);
        } else {
            dress();
        }
    }());


    /* ---------------------------------------------------
       SELF-MOUNT

       The HOME button used to be mounted from a block at the
       END of each game's own script. If anything earlier in
       that script threw, the block never ran and the player
       was stranded in the game with no way back.

       storage.js loads in <head>, before any game code can
       fail, so mounting from here means the way out is always
       there no matter what the game does.
    --------------------------------------------------- */

    (function autoMount() {

        var doc = global.document;

        if (!doc) {
            return;
        }

        var page = currentPage();

        /* every page but the hubs is a game, so play time counts */
        if (HUB_PAGES.indexOf(page) === -1) {
            startPlayClock();
        }

        /* the hub pages do not need a link to themselves */
        if (page === "map.html" || page === "login.html" || page === "") {
            return;
        }

        function go() {
            try {
                mountMapLink();
            } catch (e) {
                /* never let navigation break the page */
            }
        }

        if (doc.readyState === "loading") {
            doc.addEventListener("DOMContentLoaded", go);
        } else {
            go();
        }
    }());

}(window));
