/* =========================================================
   HACKO - tools/make-unlock.js

   Creates the password file that re-opens a locked copy.
   Reads the key from .release-secret/ (written by the last
   build), so run it in the same checkout you built from.

   Usage:
     node tools/make-unlock.js "YOURPASSWORD"

   It writes keyhost/p/<sha256(password)>.json . Publish that
   file to your GitHub Pages repo, then give the password to
   whoever should get in. The password itself never leaves
   your machine; only its hash becomes a filename.
========================================================= */

"use strict";

var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var ROOT = path.join(__dirname, "..");
var pw = process.argv[2];

if (!pw) {
    console.error("Usage: node tools/make-unlock.js \"YOURPASSWORD\"");
    process.exit(1);
}

var secPath = path.join(ROOT, ".release-secret", "secret.json");
if (!fs.existsSync(secPath)) {
    console.error("No .release-secret/secret.json found. Run tools/build-release.js first.");
    process.exit(1);
}

var sec = JSON.parse(fs.readFileSync(secPath, "utf8"));
var hash = crypto.createHash("sha256").update(pw).digest("hex");

var dir = path.join(ROOT, "keyhost", "p");
fs.mkdirSync(dir, { recursive: true });
var file = path.join(dir, hash + ".json");
fs.writeFileSync(file, JSON.stringify({ k: sec.keyObfB64 }));

console.log("Wrote keyhost/p/" + hash + ".json");
console.log("Publish it to GitHub Pages, then share the password with the client.");
