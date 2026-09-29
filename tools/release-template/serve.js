/* =========================================================
   HACKO - release server (generated into release/ by
   tools/build-release.js). Do not edit by hand.

   Serves the encrypted game (app.enc) on http://localhost.
   The decryption key is NOT in this folder: it is fetched at
   run time from the license file on the author's GitHub Pages
   and combined with a mask baked into this file, so neither
   the folder nor the license file alone can open the game.

   License file states:
     {"o":1,"k":"<key>"}  -> open  (the demo)
     {"o":0}              -> locked (needs the password)
   Change it any time; this server re-checks every few seconds.
========================================================= */

"use strict";

var http = require("http");
var crypto = require("crypto");

var MASK = Buffer.from("__MASK_B64__", "base64");
var KEY_URL = "__KEY_URL__";
var PW_BASE = "__PW_BASE__";
var PORT = Number("__PORT__") || 8777;
var ENTRY = "__ENTRY__";

var FS = require("fs");
var PATHLIB = require("path");
var ENC = FS.readFileSync(PATHLIB.join(__dirname, "app.enc"));

/* ---- parse the encrypted bundle into path -> {iv, body} ---- */
var FILES = Object.create(null);
(function parse() {
    if (ENC.slice(0, 4).toString() !== "HKE1") {
        throw new Error("app.enc is not a HACKO bundle");
    }
    var off = 4;
    var count = ENC.readUInt32BE(off); off += 4;
    for (var i = 0; i < count; i++) {
        var pathLen = ENC.readUInt16BE(off); off += 2;
        var p = ENC.slice(off, off + pathLen).toString("utf8"); off += pathLen;
        var dataLen = ENC.readUInt32BE(off); off += 4;
        var data = ENC.slice(off, off + dataLen); off += dataLen;
        /* data = iv(12) | tag(16) | ciphertext */
        FILES[p] = { iv: data.slice(0, 12), tag: data.slice(12, 28), ct: data.slice(28) };
    }
}());

var TYPES = {
    html: "text/html; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    css: "text/css; charset=utf-8",
    json: "application/json; charset=utf-8",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", svg: "image/svg+xml", webp: "image/webp",
    ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", txt: "text/plain; charset=utf-8"
};

function typeFor(p) {
    var dot = p.lastIndexOf(".");
    return TYPES[dot === -1 ? "" : p.slice(dot + 1).toLowerCase()] || "application/octet-stream";
}

function deob(kB64) {
    var k = Buffer.from(kB64, "base64");
    var out = Buffer.alloc(k.length);
    for (var i = 0; i < k.length; i++) { out[i] = k[i] ^ MASK[i % MASK.length]; }
    return out;
}

function decrypt(entry, key) {
    var d = crypto.createDecipheriv("aes-256-gcm", key, entry.iv);
    d.setAuthTag(entry.tag);
    return Buffer.concat([d.update(entry.ct), d.final()]);
}

/* ---- license state, re-checked on a short cache ---- */
var state = { open: false, unlocked: false, key: null, checkedAt: 0, reason: "starting up" };
var CHECK_MS = 12000;
var checking = null;

function refresh() {
    if (Date.now() - state.checkedAt < CHECK_MS) { return Promise.resolve(); }
    if (checking) { return checking; }
    checking = fetch(KEY_URL, { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)); })
        .then(function (j) {
            state.checkedAt = Date.now();
            if (j && j.o === 1 && j.k) {
                state.open = true; state.key = deob(j.k); state.reason = "open";
            } else {
                state.open = false; state.reason = "locked by author";
                if (!state.unlocked) { state.key = null; }
            }
        })
        .catch(function (e) {
            state.checkedAt = Date.now();
            /* fail soft: keep the last known decision, never open on error */
            if (!state.open && !state.unlocked) { state.reason = "cannot reach license server (" + e.message + ")"; }
        })
        .then(function () { checking = null; });
    return checking;
}

function tryPassword(pw) {
    var hash = crypto.createHash("sha256").update(String(pw)).digest("hex");
    return fetch(PW_BASE + hash + ".json", { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
            if (j && j.k) { state.unlocked = true; state.key = deob(j.k); return true; }
            return false;
        })
        .catch(function () { return false; });
}

function usable() { return (state.open || state.unlocked) && state.key; }

var LOCK_HTML = __LOCK_HTML__;

function send(res, code, type, body) {
    res.writeHead(code, {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
    });
    res.end(body);
}

function readBody(req) {
    return new Promise(function (resolve) {
        var chunks = [];
        req.on("data", function (c) { chunks.push(c); });
        req.on("end", function () { resolve(Buffer.concat(chunks).toString("utf8")); });
    });
}

http.createServer(function (req, res) {

    var url = req.url.split("?")[0];

    if (url === "/__unlock" && req.method === "POST") {
        readBody(req).then(function (b) {
            var pw = "";
            try { pw = JSON.parse(b).password || ""; } catch (e) { pw = ""; }
            return tryPassword(pw);
        }).then(function (ok) {
            send(res, ok ? 200 : 403, TYPES.json, JSON.stringify({ ok: ok }));
        });
        return;
    }

    refresh().then(function () {

        if (url === "/__state") {
            return send(res, 200, TYPES.json, JSON.stringify({
                open: state.open, unlocked: state.unlocked, reason: state.reason
            }));
        }

        var path = decodeURIComponent(url).replace(/^\/+/, "");
        if (path === "") { path = ENTRY; }

        if (!usable()) {
            /* locked: every navigation shows the password page */
            return send(res, 200, TYPES.html, LOCK_HTML);
        }

        var entry = FILES[path];
        if (!entry) { return send(res, 404, TYPES.txt, "Not found"); }

        var plain;
        try { plain = decrypt(entry, state.key); }
        catch (e) { return send(res, 500, TYPES.txt, "Decrypt failed"); }

        send(res, 200, typeFor(path), plain);

    });

}).listen(PORT, "127.0.0.1", function () {
    /* eslint-disable no-console */
    console.log("");
    console.log("  HACKO is running.  Open this in your browser:");
    console.log("");
    console.log("      http://localhost:" + PORT + "/");
    console.log("");
    console.log("  Leave this window open while playing. Close it to stop.");
    refresh();
});
