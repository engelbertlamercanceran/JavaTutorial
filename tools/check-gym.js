/* Debugging Gym map: every route from the entrance to Vex must
   pass the trainers in order, and every respawn point must be
   a walkable tile that is not itself inside a trainer's sight. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "aa", "gym.js"), "utf8");
const win = { addEventListener() {} };
vm.runInNewContext(src, { window: win, Image: function () {}, document: {}, performance: { now: () => 0 } });
const { MAP, trainers, SPAWN } = win.Gym;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("  FAIL " + msg); } };

const at = (x, y) => (MAP[y] || "")[x] || "#";
const isTrainer = (x, y) => trainers.some(t => t.x === x && t.y === y);
const walk = (x, y) => ".HP".includes(at(x, y)) && !isTrainer(x, y);

function reachable(from, blocked) {
  const seen = new Set([from.join()]);
  const q = [from];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const n = [x + dx, y + dy], key = n.join();
      if (seen.has(key) || !walk(...n) || blocked.has(key)) continue;
      seen.add(key); q.push(n);
    }
  }
  return seen;
}

let start;
MAP.forEach((r, y) => { const x = r.indexOf("H"); if (x >= 0) start = [x, y]; });

ok(trainers.length === 10, "ten trainers on the map");
trainers.forEach((t, k) => ok(walk(t.sx, t.sy), `trainer ${k} looks at a walkable tile`));

for (let k = 0; k < 10; k++) {
  const sight = new Set([[trainers[k].sx, trainers[k].sy].join()]);
  const r = reachable(start, sight);
  ok(!r.has([trainers[9].sx, trainers[9].sy].join()) || k === 9,
     `trainer ${k} cannot be bypassed on the way to Vex`);
  if (k < 9) {
    ok(!r.has([trainers[k + 1].sx, trainers[k + 1].sy].join()),
       `trainer ${k + 1} is only reachable after trainer ${k}`);
  }
}

SPAWN.forEach(([x, y], k) => {
  ok(walk(x, y), `spawn ${k} is walkable`);
  ok(!trainers.some((t, j) => j >= k && t.sx === x && t.sy === y), `spawn ${k} is outside every active sight`);
  const earlier = new Set(trainers.slice(k).map(t => [t.sx, t.sy].join()));
  earlier.delete([trainers[k].sx, trainers[k].sy].join());
  ok(reachable([x, y], earlier).has([trainers[k].sx, trainers[k].sy].join()),
     `from spawn ${k} Hacko can walk to trainer ${k}`);
});

console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
