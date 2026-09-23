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

    var MISSIONS = {
        1:  { title: "The Escape Room",          file: "theescaperoom.html",        badge: "VARIABLE HERO" },
        2:  { title: "The Secret Message",       file: "thesecretmessage.html",     badge: "CODE MESSENGER" },
        3:  { title: "Conditional Challenge",    file: "conditionalchallenge.html", badge: "DECISION MASTER" },
        4:  { title: "Loop Labyrinth",           file: "looplabyrinth.html",        badge: "LOOP RUNNER" },
        5:  { title: "Array Adventure",          file: "arrayadventure.html",       badge: "ARRAY EXPLORER" },
        6:  { title: "Function Fortress",        file: "functionfortress.html",     badge: "FUNCTION KNIGHT" },
        7:  { title: "Debugging Duel",           file: "",                          badge: "BUG SLAYER" },
        8:  { title: "Classroom Rescue",         file: "classroomrescue.html",      badge: "OBJECT HERO" },
        9:  { title: "Conditional Labyrinth II", file: "",                          badge: "LOGIC MASTER" },
        10: { title: "Loop Boss Battle",         file: "loopboss.html",             badge: "LOOP LEGEND" }
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

        safe.settings = {
            muted: !!(record.settings && record.settings.muted)
        };

        var missions = record.missions || {};

        Object.keys(missions).forEach(function (id) {

            var src = missions[id] || {};
            var dst = blankMission();

            dst.levelsDone = Array.isArray(src.levelsDone)
                ? src.levelsDone.slice()
                : [];

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

        write(ACTIVE_KEY, clean);
        migrateLegacy();

        return load();
    }

    function logout() {
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
            logout();
        }
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

    function requiredToUnlock(id) {
        return Math.ceil(totalLevels(id) * UNLOCK_THRESHOLD);
    }

    function completion(id) {

        var m = mission(id);
        var total = m.totalLevels || DEFAULT_TOTAL_LEVELS;
        var done = m.levelsDone.length;

        return {
            done: done,
            total: total,
            percent: total ? Math.round((done / total) * 100) : 0,
            badge: m.badge
        };
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

        return update(function (record) {

            var m = record.missions[key] || blankMission();

            if (m.levelsDone.indexOf(index) === -1) {
                m.levelsDone.push(index);
                m.levelsDone.sort(function (a, b) { return a - b; });
                record.totalXP += gained;
            }

            m.bestXP = Math.max(m.bestXP, gained);
            m.resumeLevel = Math.min(index + 1, m.totalLevels - 1);
            m.completed = m.levelsDone.length >= m.totalLevels;

            /* The badge is 100% only - clearing the 70% gate
               is not enough to earn it. */
            if (m.completed && !m.badge) {

                m.badge = true;

                var badgeName = MISSIONS[key] && MISSIONS[key].badge;

                if (badgeName && record.badges.indexOf(badgeName) === -1) {
                    record.badges.push(badgeName);
                }
            }

            record.missions[key] = m;

            var next = Number(id) + 1;

            if (next <= 10 && isUnlockedIn(record, next)) {
                record.currentMission = Math.max(record.currentMission, next);
            }
        });
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

    function setLives(id, lives) {

        var key = String(id);

        return update(function (record) {
            record.missions[key] = record.missions[key] || blankMission();
            record.missions[key].lives = Number(lives);
        });
    }

    function getLives(id) {

        var m = mission(id);

        return typeof m.lives === "number" ? m.lives : DEFAULT_LIVES;
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
       EXPORT / IMPORT
       The only way to move progress between machines in an
       offline-only build.
    --------------------------------------------------- */

    function exportToFile() {

        var record = load();

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

    var MIGRATED_FLAG = "hacko:migrated";

    function migrateLegacy() {

        var name = activeUser();

        if (!name || read(MIGRATED_FLAG + ":" + name) === "true") {
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
        write(MIGRATED_FLAG + ":" + name, "true");
    }


    /* ---------------------------------------------------
       NAVIGATION

       No game had a way back to the mission map - the only
       route out was the browser Back button, so a player who
       cleared enough levels to unlock the next mission had no
       visible way to go and start it.
    --------------------------------------------------- */

    function mountMapLink() {

        var doc = global.document;

        if (!doc || doc.getElementById("hacko-map-link")) {
            return null;
        }

        var link = doc.createElement("a");

        link.id = "hacko-map-link";

        /* aa/ sits one folder down, so the link has to climb out */
        link.href =
            (global.location && /\/aa\//.test(global.location.pathname))
                ? "../map.html"
                : "map.html";

        link.textContent = "◀ HOME";

        link.addEventListener("click", function () {
            if (global.HackoAudio) {
                global.HackoAudio.play("select");
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

        UNLOCK_THRESHOLD: UNLOCK_THRESHOLD,
        DEFAULT_LIVES: DEFAULT_LIVES,
        MISSIONS: MISSIONS,

        listUsers: listUsers,
        activeUser: activeUser,
        login: login,
        logout: logout,
        isLoggedIn: isLoggedIn,
        deleteUser: deleteUser,

        load: load,
        save: save,
        update: update,

        mission: mission,
        totalLevels: totalLevels,
        registerTotalLevels: registerTotalLevels,
        requiredToUnlock: requiredToUnlock,
        completion: completion,
        isUnlocked: isUnlocked,
        completeLevel: completeLevel,
        setResumeLevel: setResumeLevel,
        getResumeLevel: getResumeLevel,
        setLives: setLives,
        getLives: getLives,

        bindAutosave: bindAutosave,

        exportToFile: exportToFile,
        importFile: importFile,

        isMuted: isMuted,
        setMuted: setMuted,

        migrateLegacy: migrateLegacy,
        mountMapLink: mountMapLink,
        isTestMode: isTestMode,
        setTestMode: setTestMode
    };


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

        var page = (global.location && global.location.pathname || "")
            .split("/").pop().toLowerCase();

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
