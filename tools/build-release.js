/* =========================================================
   HACKO - tools/build-release.js

   Builds an ENCRYPTED copy of the game into release/. Two modes:

   OFFLINE (recommended for a time-limited test hand-off):
     node tools/build-release.js --password "DEMOPASS" --expires 2026-09-30T00:00
     - No internet, no repo. The client runs start-windows.bat,
       types the password, and it works until --expires, then locks.
     - The decryption key is wrapped by the password inside the
       server file. Rebuild + resend to renew.

   ONLINE (remote kill switch via GitHub Pages):
     node tools/build-release.js --keybase https://<user>.github.io/<repo>/
     - The key is fetched at run time from your GitHub Pages s.json.
       Flip that file to lock every copy. See keyhost/ output.

   Common options: [--port 8777] [--entry index.html] [--out release]
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var ROOT = path.join(__dirname, "..");
var TPL = path.join(__dirname, "release-template");

function arg(name, def) {
    var i = process.argv.indexOf("--" + name);
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

var PASSWORD = arg("password", "");
var EXPIRES = arg("expires", "2026-09-30T00:00");
var KEYBASE = arg("keybase", "");
var PORT = arg("port", "8777");
var ENTRY = arg("entry", "index.html");
var OUT = path.join(ROOT, arg("out", "release"));

var OFFLINE = !!PASSWORD;
if (!OFFLINE && !KEYBASE) {
    console.error("ERROR: choose a mode.");
    console.error("  offline: node tools/build-release.js --password \"DEMOPASS\" --expires 2026-09-30T00:00");
    console.error("  online : node tools/build-release.js --keybase https://you.github.io/hacko-key/");
    process.exit(1);
}

/* ---- collect the game files ---- */
var ALLOW = /\.(html|js|css|png|jpe?g|gif|svg|webp|ico|woff2?|mp3|wav|ogg)$/i;
var SKIP_DIR = /^(\.git|node_modules|tools|\.removed|release|keyhost|\.release-secret)$/;
var SKIP_FILE = /(pokemon|sample|screenshot)/i;

function walk(dir, base, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
        if (e.isDirectory()) {
            if (!SKIP_DIR.test(e.name)) { walk(path.join(dir, e.name), base + e.name + "/", out); }
        } else if (ALLOW.test(e.name) && !SKIP_FILE.test(e.name)) {
            out.push(base + e.name);
        }
    });
    return out;
}

var files = walk(ROOT, "", []).sort();
console.log("Encrypting " + files.length + " files...");

/* ---- encrypt into app.enc: HKE1 | count | [pathLen path dataLen data]* ---- */
var KEY = crypto.randomBytes(32);
var parts = [];
var header = Buffer.alloc(8);
header.write("HKE1", 0);
header.writeUInt32BE(files.length, 4);
parts.push(header);

files.forEach(function (rel) {
    var plain = fs.readFileSync(path.join(ROOT, rel));
    var iv = crypto.randomBytes(12);
    var c = crypto.createCipheriv("aes-256-gcm", KEY, iv);
    var ct = Buffer.concat([c.update(plain), c.final()]);
    var data = Buffer.concat([iv, c.getAuthTag(), ct]);   /* iv(12) | tag(16) | ct */

    var pathBuf = Buffer.from(rel, "utf8");
    var pathLen = Buffer.alloc(2); pathLen.writeUInt16BE(pathBuf.length, 0);
    var dataLen = Buffer.alloc(4); dataLen.writeUInt32BE(data.length, 0);
    parts.push(pathLen, pathBuf, dataLen, data);
});
var enc = Buffer.concat(parts);

function fresh(dir) {
    /* empty the folder's contents rather than remove the folder itself,
       so an open terminal or Explorer window on it does not block us */
    fs.mkdirSync(dir, { recursive: true });
    fs.readdirSync(dir).forEach(function (name) {
        try { fs.rmSync(path.join(dir, name), { recursive: true, force: true }); }
        catch (e) { /* a running server may hold node/.hako; leave it */ }
    });
}
function fill(tplName, map) {
    var t = fs.readFileSync(path.join(TPL, tplName), "utf8");
    Object.keys(map).forEach(function (k) { t = t.split(k).join(map[k]); });
    return t;
}

var lockHtml = fs.readFileSync(path.join(TPL, "lock.html"), "utf8");

fresh(OUT);
fs.writeFileSync(path.join(OUT, "app.enc"), enc);
fs.writeFileSync(path.join(OUT, "README.txt"), fs.readFileSync(path.join(TPL, "README.txt")));
fs.writeFileSync(path.join(OUT, "README.md"), fs.readFileSync(path.join(TPL, "README.md")));
fs.writeFileSync(path.join(OUT, "start-windows.bat"), fill("start-windows.bat", { "__PORT__": PORT }));
fs.writeFileSync(path.join(OUT, "start-mac-linux.sh"), fill("start-mac-linux.sh", { "__PORT__": PORT }));

if (OFFLINE) {

    /* --expires accepts an absolute local time (2026-09-30T00:00)
       or, for testing, a relative offset from now: +90s, +2m, +3h, +1d */
    var expMs;
    var relMatch = /^\+(\d+)\s*([smhd])$/.exec(EXPIRES.trim());
    if (relMatch) {
        var unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[relMatch[2]];
        expMs = Date.now() + Number(relMatch[1]) * unit;
    } else {
        expMs = new Date(EXPIRES).getTime();
    }
    if (isNaN(expMs)) {
        console.error("ERROR: --expires must look like 2026-09-30T00:00 (local time) or +2m. Got: " + EXPIRES);
        process.exit(1);
    }

    var salt = crypto.randomBytes(16);
    var dk = crypto.scryptSync(PASSWORD, salt, 32);
    var wiv = crypto.randomBytes(12);
    var wc = crypto.createCipheriv("aes-256-gcm", dk, wiv);
    var wct = Buffer.concat([wc.update(KEY), wc.final()]);
    var wrap = Buffer.concat([wiv, wc.getAuthTag(), wct]);

    fs.writeFileSync(path.join(OUT, "serve.js"), fill("serve-offline.js", {
        "__SALT__": salt.toString("base64"),
        "__WRAP__": wrap.toString("base64"),
        "__EXPIRES__": String(expMs),
        "__PORT__": PORT,
        "__ENTRY__": ENTRY,
        "__LOCK_HTML__": JSON.stringify(lockHtml)
    }));

    console.log("");
    console.log("Done (OFFLINE). release/app.enc is " + (enc.length / 1048576).toFixed(2) + " MB.");
    console.log("");
    console.log("  Password : " + PASSWORD);
    console.log("  Works until: " + new Date(expMs).toString());
    console.log("");
    console.log("HAND OFF");
    console.log("  Zip the release/ folder and send it with the password.");
    console.log("  Client: double-click start-windows.bat, type the password, play.");
    console.log("  After the date it locks by itself. Rebuild + resend to renew.");

} else {

    if (KEYBASE.charAt(KEYBASE.length - 1) !== "/") { KEYBASE += "/"; }
    var MASK = crypto.randomBytes(32);
    var keyObfB64 = Buffer.from(KEY.map(function (b, i) { return b ^ MASK[i]; })).toString("base64");

    fs.writeFileSync(path.join(OUT, "serve.js"), fill("serve.js", {
        "__MASK_B64__": MASK.toString("base64"),
        "__KEY_URL__": KEYBASE + "s.json",
        "__PW_BASE__": KEYBASE + "p/",
        "__PORT__": PORT,
        "__ENTRY__": ENTRY,
        "__LOCK_HTML__": JSON.stringify(lockHtml)
    }));

    var KH = path.join(ROOT, "keyhost");
    fresh(KH);
    fs.writeFileSync(path.join(KH, "s.json"), JSON.stringify({ o: 1, k: keyObfB64 }));
    fs.writeFileSync(path.join(KH, "s.locked.json"), JSON.stringify({ o: 0 }));
    fs.mkdirSync(path.join(KH, "p"), { recursive: true });
    fs.writeFileSync(path.join(KH, "p", ".keep"), "");

    var SEC = path.join(ROOT, ".release-secret");
    fresh(SEC);
    fs.writeFileSync(path.join(SEC, "secret.json"), JSON.stringify({
        keyB64: KEY.toString("base64"), maskB64: MASK.toString("base64"),
        keyObfB64: keyObfB64, keybase: KEYBASE
    }, null, 2));

    console.log("");
    console.log("Done (ONLINE). release/app.enc is " + (enc.length / 1048576).toFixed(2) + " MB.");
    console.log("  1. Publish keyhost/s.json to your GitHub Pages repo (open state).");
    console.log("  2. Zip release/ and send it.");
    console.log("  3. Lock later: publish {\"o\":0} as s.json. Password: tools/make-unlock.js");
    console.log("  Keep .release-secret/ private.");
}
