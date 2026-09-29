/* =========================================================
   HACKO - offline test server (generated into release/ by
   tools/build-release.js --password ...). Do not edit.

   Fully offline: no internet, no license server. The game is
   AES-256 encrypted; the key is wrapped by the access
   password and only unwraps when the right password is typed
   AND the test period has not ended. The end date is checked
   against the computer clock; a small guard resists setting
   the clock backwards.
========================================================= */

"use strict";

var http = require("http");
var crypto = require("crypto");
var fs = require("fs");
var path = require("path");

var SALT = Buffer.from("__SALT__", "base64");
var WRAP = Buffer.from("__WRAP__", "base64");   /* iv(12) | tag(16) | ct */
var EXPIRES = Number("__EXPIRES__");            /* ms since epoch, local */
var PORT = Number("__PORT__") || 8777;
var ENTRY = "__ENTRY__";

var ENC = fs.readFileSync(path.join(__dirname, "app.enc"));

/* ---- parse encrypted bundle: HKE1 | count | [pathLen path dataLen data]* ---- */
var FILES = Object.create(null);
(function parse() {
    if (ENC.slice(0, 4).toString() !== "HKE1") { throw new Error("app.enc is not a HACKO bundle"); }
    var off = 4, count = ENC.readUInt32BE(off); off += 4;
    for (var i = 0; i < count; i++) {
        var pathLen = ENC.readUInt16BE(off); off += 2;
        var p = ENC.slice(off, off + pathLen).toString("utf8"); off += pathLen;
        var dataLen = ENC.readUInt32BE(off); off += 4;
        var data = ENC.slice(off, off + dataLen); off += dataLen;
        FILES[p] = { iv: data.slice(0, 12), tag: data.slice(12, 28), ct: data.slice(28) };
    }
}());

var TYPES = {
    html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8",
    css: "text/css; charset=utf-8", json: "application/json; charset=utf-8",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    svg: "image/svg+xml", webp: "image/webp", ico: "image/x-icon",
    woff: "font/woff", woff2: "font/woff2", mp3: "audio/mpeg", wav: "audio/wav",
    ogg: "audio/ogg", txt: "text/plain; charset=utf-8"
};
function typeFor(p) {
    var dot = p.lastIndexOf(".");
    return TYPES[dot === -1 ? "" : p.slice(dot + 1).toLowerCase()] || "application/octet-stream";
}

/* ---- clock-rollback guard: remember the latest time seen ---- */
var SEEN_FILE = path.join(__dirname, ".hako");
var DAY = 86400000;
function seen() {
    try { return Number(JSON.parse(fs.readFileSync(SEEN_FILE, "utf8")).t) || 0; }
    catch (e) { return 0; }
}
function noteTime() {
    var now = Date.now(), s = seen();
    if (now > s) { try { fs.writeFileSync(SEEN_FILE, JSON.stringify({ t: now })); } catch (e) {} }
}
function tampered() { return Date.now() < seen() - DAY; }   /* clock pushed back > 1 day */
function expired() { return tampered() || Date.now() > EXPIRES; }

/* ---- state ---- */
var state = { key: null, unlocked: false };
function usable() { return state.unlocked && state.key && !expired(); }

function unwrap(pw) {
    var dk = crypto.scryptSync(String(pw), SALT, 32);
    var iv = WRAP.slice(0, 12), tag = WRAP.slice(12, 28), ct = WRAP.slice(28);
    var d = crypto.createDecipheriv("aes-256-gcm", dk, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]);   /* throws on wrong password */
}

function decrypt(entry, key) {
    var d = crypto.createDecipheriv("aes-256-gcm", key, entry.iv);
    d.setAuthTag(entry.tag);
    return Buffer.concat([d.update(entry.ct), d.final()]);
}

var LOCK_HTML = __LOCK_HTML__;

function send(res, code, type, body) {
    res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.end(body);
}
function readBody(req) {
    return new Promise(function (resolve) {
        var c = [];
        req.on("data", function (d) { c.push(d); });
        req.on("end", function () { resolve(Buffer.concat(c).toString("utf8")); });
    });
}

/* re-check expiry periodically so it locks mid-session at the deadline */
setInterval(function () {
    noteTime();
    if (expired()) { state.unlocked = false; state.key = null; }
}, 30000);

http.createServer(function (req, res) {
    noteTime();
    var url = req.url.split("?")[0];

    if (url === "/__unlock" && req.method === "POST") {
        readBody(req).then(function (b) {
            var pw = ""; try { pw = JSON.parse(b).password || ""; } catch (e) {}
            if (expired()) { return send(res, 403, TYPES.json, JSON.stringify({ ok: false, reason: "expired" })); }
            var key;
            try { key = unwrap(pw); }
            catch (e) { return send(res, 403, TYPES.json, JSON.stringify({ ok: false, reason: "wrong" })); }
            state.key = key; state.unlocked = true;
            send(res, 200, TYPES.json, JSON.stringify({ ok: true }));
        });
        return;
    }

    if (url === "/__state") {
        return send(res, 200, TYPES.json, JSON.stringify({ unlocked: state.unlocked, expired: expired() }));
    }

    if (!usable()) { return send(res, 200, TYPES.html, LOCK_HTML); }

    var p = decodeURIComponent(url).replace(/^\/+/, "");
    if (p === "") { p = ENTRY; }
    var entry = FILES[p];
    if (!entry) { return send(res, 404, TYPES.txt, "Not found"); }
    var plain;
    try { plain = decrypt(entry, state.key); }
    catch (e) { return send(res, 500, TYPES.txt, "Decrypt failed"); }
    send(res, 200, typeFor(p), plain);

}).listen(PORT, "127.0.0.1", function () {
    noteTime();
    console.log("");
    console.log("  HACKO is running.  Open this in your browser:");
    console.log("");
    console.log("      http://localhost:" + PORT + "/");
    console.log("");
    console.log("  Leave this window open while playing. Close it to stop.");
});
