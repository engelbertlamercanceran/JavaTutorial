/* Checks whether a password matches the build currently in release/serve.js.
   Usage:  node tools/check-password.js "THE PASSWORD"
   This reads the SAME baked values the running server uses, so if this says
   OK but the browser still says "wrong password", your server is running an
   older build - stop it and start it again. */
"use strict";
var fs = require("fs"), path = require("path"), crypto = require("crypto");

var pw = process.argv[2];
if (pw === undefined) {
    console.error('Usage: node tools/check-password.js "THE PASSWORD"');
    process.exit(1);
}

var serve = fs.readFileSync(path.join(__dirname, "..", "release", "serve.js"), "utf8");
function grab(name) {
    var m = serve.match(new RegExp("var " + name + " = Buffer\\.from\\(\"([^\"]*)\", \"base64\"\\)"));
    if (!m) { console.error("Could not find " + name + " in release/serve.js - is it an offline build?"); process.exit(1); }
    return Buffer.from(m[1], "base64");
}
var SALT = grab("SALT"), WRAP = grab("WRAP");
var expM = serve.match(/var EXPIRES = Number\("(\d+)"\)/);
var EXP = expM ? Number(expM[1]) : 0;

try {
    var dk = crypto.scryptSync(String(pw), SALT, 32);
    var d = crypto.createDecipheriv("aes-256-gcm", dk, WRAP.slice(0, 12));
    d.setAuthTag(WRAP.slice(12, 28));
    Buffer.concat([d.update(WRAP.slice(28)), d.final()]);
    console.log("OK  - this password matches the build in release/serve.js");
    console.log("      (length " + String(pw).length + " characters)");
    if (EXP) {
        console.log("      expires: " + new Date(EXP).toString());
        console.log("      " + (Date.now() > EXP ? "ALREADY EXPIRED - it will still say 'test period has ended'"
                                                 : "not expired yet"));
    }
} catch (e) {
    console.log("NO  - this password does NOT match the build in release/serve.js");
    console.log("      You typed " + String(pw).length + " characters. Check for typos, caps, or spaces,");
    console.log("      and make sure you rebuilt AND restarted the server.");
}
