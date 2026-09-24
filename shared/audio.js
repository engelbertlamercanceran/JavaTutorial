/* =========================================================
   HACKO - shared/audio.js
   Synthesised sound for every game. No audio files.

       HackoAudio.play("correct");
       HackoAudio.music.play("explore");
       HackoAudio.mountToggle(document.body);

   Two things browsers make awkward, both handled here:

   1. An AudioContext starts suspended until a real user
      gesture, and while suspended its currentTime stays at
      0. Scheduling a note at "currentTime + 0" then lands in
      the past once the context finally starts, and the note
      is dropped - which is why sound could go completely
      silent. Every note is now scheduled against a floor
      that can never be behind the clock.

   2. resume() must be called from inside a gesture handler.
      Anything requested before that is queued and replayed
      the moment audio actually starts.
========================================================= */

(function (global) {
    "use strict";

    /* Captured during parse, so the page can say which track it
       wants with <script src="shared/audio.js" data-track="stealth">.
       Starting the music from here rather than from a block at the
       end of the game's own script means a runtime error in the game
       can no longer leave the page silent. */
    var ownScript = global.document && global.document.currentScript;

    var MUTE_KEY = "hacko:muted";

    /* how far ahead notes are scheduled */
    var LOOKAHEAD = 0.05;

    var ctx = null;
    var master = null;
    var sfxBus = null;
    var musicBus = null;

    var reverb = null;
    var reverbSend = null;

    /* Noise burst with an exponential decay - a cheap but convincing
       impulse response for a small room. */
    function makeImpulse(seconds, decay) {

        var rate = ctx.sampleRate;
        var length = Math.floor(rate * seconds);
        var impulse = ctx.createBuffer(2, length, rate);

        for (var channel = 0; channel < 2; channel++) {

            var data = impulse.getChannelData(channel);

            for (var i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) *
                    Math.pow(1 - i / length, decay);
            }
        }

        return impulse;
    }

    var muted = false;
    var started = false;
    var pending = [];

    try {
        muted = global.localStorage.getItem(MUTE_KEY) === "true";
    } catch (e) {
        /* storage blocked - default to unmuted */
    }


    /* ---------------------------------------------------
       CONTEXT
    --------------------------------------------------- */

    function ensure() {

        if (ctx) {
            return ctx;
        }

        var Ctor = global.AudioContext || global.webkitAudioContext;

        if (!Ctor) {
            return null;
        }

        ctx = new Ctor();

        master = ctx.createGain();
        master.gain.value = 1.0;
        master.connect(ctx.destination);

        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.75;
        sfxBus.connect(master);

        musicBus = ctx.createGain();
        musicBus.gain.value = 0.38;
        musicBus.connect(master);

        /* A short plate-ish reverb. Pure oscillator blips sound flat
           and cheap on their own; a little tail is most of what makes
           them read as a game rather than a test tone. */
        reverb = ctx.createConvolver();
        reverb.buffer = makeImpulse(1.7, 2.4);

        reverbSend = ctx.createGain();
        reverbSend.gain.value = 0.22;
        reverbSend.connect(reverb);
        reverb.connect(master);

        sfxBus.connect(reverbSend);
        musicBus.connect(reverbSend);

        return ctx;
    }

    /* Never schedule behind the clock. */
    function when(offset) {
        return ensure().currentTime + LOOKAHEAD + (offset || 0);
    }

    function flushPending() {

        var queued = pending;
        pending = [];

        queued.forEach(function (run) {
            try {
                run();
            } catch (e) {
                /* a queued sound is never worth an exception */
            }
        });
    }

    /* Called from real gesture handlers. */
    function unlock() {

        var c = ensure();

        if (!c) {
            return;
        }

        if (c.state === "suspended") {

            var resumed = c.resume();

            if (resumed && resumed.then) {
                resumed.then(function () {
                    started = true;
                    flushPending();
                    music.resumeIfWanted();
                });
                return;
            }
        }

        if (c.state === "running" && !started) {
            started = true;
            flushPending();
            music.resumeIfWanted();
        }
    }

    ["pointerdown", "keydown", "touchstart", "click"].forEach(function (evt) {
        global.addEventListener(evt, unlock, { passive: true });
    });

    /* Runs work now if audio is live, otherwise queues it. */
    function audible(run) {

        if (muted) {
            return;
        }

        var c = ensure();

        if (!c) {
            return;
        }

        if (c.state === "running") {
            started = true;
            run();
            return;
        }

        /* keep the queue short - stale blips are noise */
        if (pending.length < 8) {
            pending.push(run);
        }

        unlock();
    }


    /* ---------------------------------------------------
       PRIMITIVES
    --------------------------------------------------- */

    function voice(bus, freq, start, duration, type, peak, endFreq) {

        var c = ensure();

        if (!c) {
            return;
        }

        var t0 = when(start);
        var osc = c.createOscillator();
        var gain = c.createGain();

        osc.type = type || "square";
        osc.frequency.setValueAtTime(freq, t0);

        if (endFreq) {
            osc.frequency.exponentialRampToValueAtTime(
                Math.max(endFreq, 1),
                t0 + duration
            );
        }

        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(
            Math.max(peak, 0.0002),
            t0 + Math.min(0.015, duration / 3)
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

        osc.connect(gain);
        gain.connect(bus);

        osc.start(t0);
        osc.stop(t0 + duration + 0.03);
    }

    function tone(freq, start, duration, type, peak, endFreq) {
        voice(sfxBus, freq, start, duration, type, peak, endFreq);
    }

    function noise(start, duration, peak, cutoff) {

        var c = ensure();

        if (!c) {
            return;
        }

        var t0 = when(start);
        var frames = Math.max(1, Math.floor(c.sampleRate * duration));
        var buffer = c.createBuffer(1, frames, c.sampleRate);
        var data = buffer.getChannelData(0);

        for (var i = 0; i < frames; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        var src = c.createBufferSource();
        src.buffer = buffer;

        var filter = c.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = cutoff || 1200;

        var gain = c.createGain();
        gain.gain.setValueAtTime(Math.max(peak, 0.0002), t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(sfxBus);

        src.start(t0);
        src.stop(t0 + duration);
    }


    /* ---------------------------------------------------
       SOUND EFFECTS
    --------------------------------------------------- */

    /* A struck-bell tone: a bright partial decaying faster than the
       body underneath it. Two oscillators is the difference between
       "beep" and "chime". */
    function bell(freq, start, duration, peak) {
        voice(sfxBus, freq, start, duration, "sine", peak);
        voice(sfxBus, freq * 2.76, start, duration * 0.45, "sine", peak * 0.4);
    }

    /* Two detuned copies of the same note, which thickens a thin
       oscillator into something with body. */
    function fat(freq, start, duration, type, peak, endFreq) {
        voice(sfxBus, freq, start, duration, type, peak, endFreq);
        voice(sfxBus, freq * 1.006, start, duration, type, peak * 0.6,
            endFreq ? endFreq * 1.006 : 0);
    }

    var SFX = {

        /* Fires constantly, so it stays quiet and never repeats at
           exactly the same pitch - identical footsteps sound robotic. */
        step: function () {
            var f = 150 + Math.random() * 30;
            voice(sfxBus, f, 0, 0.07, "triangle", 0.15, f * 0.7);
            noise(0, 0.045, 0.08, 2600);
        },

        jump: function () {
            fat(300, 0, 0.13, "square", 0.09, 700);
            noise(0, 0.05, 0.05, 3000);
        },

        land: function () {
            voice(sfxBus, 90, 0, 0.11, "sine", 0.16, 55);
            noise(0, 0.08, 0.1, 900);
        },

        pickup: function () {
            bell(988, 0, 0.22, 0.13);
            bell(1319, 0.06, 0.26, 0.1);
        },

        correct: function () {
            bell(659, 0, 0.3, 0.14);
            bell(988, 0.08, 0.34, 0.12);
            bell(1319, 0.16, 0.4, 0.09);
        },

        wrong: function () {
            fat(196, 0, 0.26, "sawtooth", 0.13, 98);
            noise(0, 0.1, 0.07, 700);
        },

        hit: function () {
            noise(0, 0.14, 0.26, 1400);
            voice(sfxBus, 160, 0, 0.16, "sawtooth", 0.16, 60);
            voice(sfxBus, 420, 0, 0.09, "square", 0.07, 180);
        },

        unlock: function () {
            [523, 659, 784, 1047].forEach(function (f, i) {
                bell(f, i * 0.07, 0.36, 0.11);
            });
        },

        open: function () {
            voice(sfxBus, 260, 0, 0.18, "triangle", 0.1, 560);
            noise(0.02, 0.09, 0.045, 1800);
        },

        win: function () {
            /* melody with a third underneath it */
            [523, 659, 784, 1047].forEach(function (f, i) {
                bell(f, i * 0.11, 0.5, 0.13);
                voice(sfxBus, f * 0.8, i * 0.11, 0.42, "triangle", 0.05);
            });
            bell(1319, 0.44, 0.9, 0.14);
        },

        gameover: function () {
            [440, 370, 294, 220].forEach(function (f, i) {
                fat(f, i * 0.17, 0.42, "sawtooth", 0.12);
            });
            voice(sfxBus, 110, 0, 1.1, "sine", 0.1, 82);
        },

        select: function () {
            bell(784, 0, 0.1, 0.09);
        }
    };


    /* ---------------------------------------------------
       OPTIONAL SOUND FILES

       Everything above is synthesised, so the game needs no
       assets. If you would rather use recorded sounds, drop
       CC0 files into shared/sfx/ named after the effects
       (step.mp3, correct.mp3, ...) and call:

           HackoAudio.loadSamples("shared/sfx/");

       Anything that loads replaces the synth version; anything
       missing keeps it. Nothing breaks if the folder is empty.
       Kenney (kenney.nl/assets) and freesound.org both have
       CC0 packs that suit this.
    --------------------------------------------------- */

    var samples = {};

    function loadSamples(basePath, names) {

        var c = ensure();

        if (!c || !global.fetch) {
            return Promise.resolve([]);
        }

        var wanted = names || Object.keys(SFX);
        var base = basePath || "shared/sfx/";

        return Promise.all(wanted.map(function (name) {

            return global.fetch(base + name + ".mp3")
                .then(function (res) {
                    return res.ok ? res.arrayBuffer() : null;
                })
                .then(function (bytes) {
                    return bytes ? c.decodeAudioData(bytes) : null;
                })
                .then(function (buffer) {
                    if (buffer) {
                        samples[name] = buffer;
                        return name;
                    }
                    return null;
                })
                .catch(function () {
                    return null;
                });

        })).then(function (loaded) {
            return loaded.filter(Boolean);
        });
    }

    function playSample(name) {

        var c = ensure();
        var src = c.createBufferSource();

        src.buffer = samples[name];
        src.connect(sfxBus);
        src.start(when(0));
    }


    /* Notes by name, so the patterns below stay readable.
       "x" is a hit and "." is a rest. */
    var SEMITONE = {
        C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5,
        "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11
    };

    function hz(name) {

        if (!name || name === "-") {
            return 0;
        }

        var parts = /^([A-G]#?)(\d)$/.exec(name);

        if (!parts) {
            return 0;
        }

        var steps = SEMITONE[parts[1]] - 9;          /* relative to A */
        var octave = Number(parts[2]) - 4;

        return 440 * Math.pow(2, octave + steps / 12);
    }

    /* Each track is 16 steps of sixteenth notes: a kick, a hat, a bass
       line, a lead line, and a pad chord that changes every 8 steps.
       Layering those is what makes it sound like music rather than a
       repeating blip. */
    var TRACKS = {

        menu: {
            bpm: 82,
            kick: "x...x...x...x...",
            hat:  "..x...x...x...x.",
            bass: ["A2","-","-","E3","-","-","A2","-","F2","-","-","C3","-","-","F2","-"],
            lead: ["A4","-","C5","-","E5","-","-","C5","F4","-","A4","-","C5","-","-","A4"],
            pads: [["A3","C4","E4"], ["F3","A3","C4"]],
            leadType: "triangle"
        },

        /* Bouncy major-key chiptune - the platformer idiom, where
           the old minor-key wander felt like a menu screen. Written
           for this game rather than borrowed from one. */
        escape: {
            bpm: 138,
            kick: "x..x..x.x..x..x.",
            hat:  ".x.x.x.x.x.x.x.x",
            bass: ["C3","-","G2","-","C3","-","G2","-",
                   "F2","-","C3","-","G2","-","G2","-"],
            lead: ["E5","-","G5","-","E5","C5","-","D5",
                   "F5","-","E5","-","C5","-","D5","-"],
            pads: [["C4","E4","G4"], ["F3","A3","C4"]],
            leadType: "square"
        },

        stealth: {
            bpm: 88,
            kick: "x...x...x...x...",
            hat:  "..x.x...x.x.x...",
            bass: ["D2","-","D2","-","A2","-","D2","-","A#1","-","A#1","-","F2","-","A#1","-"],
            lead: ["D4","-","F4","-","A4","-","F4","-","A#4","-","A4","-","F4","-","D4","-"],
            pads: [["D3","F3","A3"], ["A#2","D3","F3"]],
            leadType: "sine"
        },

        defuse: {
            bpm: 126,
            kick: "x...x...x...x...",
            hat:  "x.x.x.x.x.x.x.x.",
            bass: ["E2","-","E2","-","E2","-","E2","-","D2","-","D2","-","D2","-","D2","-"],
            lead: ["B4","-","-","-","A4","-","-","-","G4","-","-","-","F#4","-","-","-"],
            pads: [["E3","G3","B3"], ["D3","F3","A3"]],
            leadType: "square"
        },

        labyrinth: {
            bpm: 104,
            kick: "x...x...x...x...",
            hat:  "..x.x.x...x.x.x.",
            bass: ["C2","-","C2","-","G2","-","C2","-","A#1","-","A#1","-","F2","-","A#1","-"],
            lead: ["C5","-","D#5","-","G5","-","D#5","-","A#4","-","D5","-","F5","-","D5","-"],
            pads: [["C3","D#3","G3"], ["A#2","D3","F3"]],
            leadType: "triangle"
        },

        adventure: {
            bpm: 112,
            kick: "x...x...x...x...",
            hat:  "..x...x...x...x.",
            bass: ["G2","-","-","D3","-","-","G2","-","C3","-","-","G2","-","-","C3","-"],
            lead: ["G4","-","B4","-","D5","-","B4","G4","C5","-","E5","-","G5","-","E5","-"],
            pads: [["G3","B3","D4"], ["C4","E4","G4"]],
            leadType: "square"
        },

        fortress: {
            bpm: 92,
            kick: "x...x...x...x...",
            hat:  "..x.x...x.x.x...",
            bass: ["D2","-","D2","-","A2","-","D2","-","A#1","-","A#1","-","C2","-","G2","-"],
            lead: ["D4","-","-","F4","-","-","A4","-","D5","-","-","A4","-","-","F4","-"],
            pads: [["D3","F3","A3"], ["A#2","D3","F3"]],
            leadType: "triangle"
        },

        rescue: {
            bpm: 100,
            kick: "x...x...x...x...",
            hat:  "..x.x.x...x.x.x.",
            bass: ["F2","-","F2","-","C3","-","F2","-","D2","-","D2","-","A2","-","D2","-"],
            lead: ["F4","-","A4","-","C5","-","A4","-","D5","-","C5","-","A4","-","F4","-"],
            pads: [["F3","A3","C4"], ["D3","F3","A3"]],
            leadType: "triangle"
        },

        gym: {
            bpm: 118,
            kick: "x...x...x...x...",
            hat:  "x.x.x.x.x.x.x.x.",
            bass: ["A2","-","A2","-","C3","-","A2","-","G2","-","G2","-","A2","-","-","-"],
            lead: ["A4","-","C5","-","E5","-","D5","-","C5","-","A4","-","G4","-","A4","-"],
            pads: [["A3","C4","E4"], ["G3","A#3","D4"]],
            leadType: "square"
        },

        boss: {
            bpm: 140,
            kick: "x..x..x.x..x..x.",
            hat:  "x.x.x.x.x.x.x.x.",
            bass: ["E2","E2","-","E2","G2","-","E2","-","D2","D2","-","D2","F2","-","D2","-"],
            lead: ["E5","-","D5","-","B4","-","D5","-","C5","-","B4","-","G4","-","B4","-"],
            pads: [["E3","G3","B3"], ["D3","F3","A3"]],
            leadType: "square"
        }
    };


    function kickDrum(at) {

        var c = ensure();
        var t0 = when(at);

        var osc = c.createOscillator();
        var gain = c.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(140, t0);
        osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.13);

        gain.gain.setValueAtTime(0.5, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);

        osc.connect(gain);
        gain.connect(musicBus);

        osc.start(t0);
        osc.stop(t0 + 0.2);
    }

    function hatHit(at) {

        var c = ensure();
        var t0 = when(at);
        var frames = Math.floor(c.sampleRate * 0.03);
        var buffer = c.createBuffer(1, frames, c.sampleRate);
        var data = buffer.getChannelData(0);

        for (var i = 0; i < frames; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        var src = c.createBufferSource();
        src.buffer = buffer;

        var filter = c.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 7000;

        var gain = c.createGain();
        gain.gain.setValueAtTime(0.12, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(musicBus);

        src.start(t0);
        src.stop(t0 + 0.04);
    }

    function padChord(at, notes, length) {
        notes.forEach(function (note, i) {
            voice(musicBus, hz(note) * (i === 1 ? 1.004 : 1),
                at, length, "sine", 0.05);
        });
    }


    var music = {

        name: null,
        wanted: null,
        timer: null,
        step: 0,
        nextTime: 0,

        play: function (name) {

            if (!TRACKS[name]) {
                return;
            }

            music.wanted = name;

            if (music.name === name && music.timer) {
                return;
            }

            music.stop(true);
            music.name = name;
            music.step = 0;

            if (muted) {
                return;
            }

            var c = ensure();

            if (!c || c.state !== "running") {
                unlock();
                return;
            }

            music.nextTime = c.currentTime + 0.12;
            music.timer = global.setInterval(music.tick, 80);
            music.tick();
        },

        tick: function () {

            var c = ensure();

            if (!c || muted || !music.name) {
                return;
            }

            var track = TRACKS[music.name];
            var stepLength = 60 / track.bpm / 4;      /* sixteenths */

            while (music.nextTime < c.currentTime + 0.4) {

                var i = music.step % 16;
                var at = music.nextTime - c.currentTime - LOOKAHEAD;

                if (track.kick[i] === "x") {
                    kickDrum(at);
                }

                if (track.hat[i] === "x") {
                    hatHit(at);
                }

                var bass = hz(track.bass[i]);

                if (bass) {
                    voice(musicBus, bass, at, stepLength * 3.2,
                        "triangle", 0.3);
                }

                var lead = hz(track.lead[i]);

                if (lead) {
                    voice(musicBus, lead, at, stepLength * 1.8,
                        track.leadType, 0.16);
                }

                if (i === 0 || i === 8) {
                    padChord(at, track.pads[i === 0 ? 0 : 1],
                        stepLength * 8);
                }

                music.nextTime += stepLength;
                music.step += 1;
            }
        },

        stop: function (keepWanted) {

            if (music.timer) {
                global.clearInterval(music.timer);
                music.timer = null;
            }

            music.name = null;

            if (!keepWanted) {
                music.wanted = null;
            }
        },

        resumeIfWanted: function () {
            if (music.wanted && !music.timer && !muted) {
                var name = music.wanted;
                music.name = null;
                music.play(name);
            }
        }
    };

    /* do not keep playing in a hidden tab */
    global.addEventListener("visibilitychange", function () {

        if (!global.document) {
            return;
        }

        if (global.document.visibilityState === "hidden") {
            if (music.timer) {
                global.clearInterval(music.timer);
                music.timer = null;
            }
        } else {
            music.resumeIfWanted();
        }
    });


    /* ---------------------------------------------------
       PUBLIC API
    --------------------------------------------------- */

    var HackoAudio = {

        play: function (name) {

            if (samples[name]) {
                audible(function () { playSample(name); });
                return;
            }

            var sound = SFX[name];

            if (!sound) {
                return;
            }

            audible(sound);
        },

        loadSamples: loadSamples,

        music: music,

        setMuted: function (value) {

            muted = !!value;

            try {
                global.localStorage.setItem(MUTE_KEY, String(muted));
            } catch (e) {
                /* session-only mute is still a mute */
            }

            if (muted) {
                pending = [];
                music.stop(true);
            } else {
                unlock();
                music.resumeIfWanted();
            }

            return muted;
        },

        toggleMuted: function () {
            return HackoAudio.setMuted(!muted);
        },

        isMuted: function () {
            return muted;
        },

        /* 0..1 */
        setVolume: function (sfxLevel, musicLevel) {

            ensure();

            if (sfxBus && typeof sfxLevel === "number") {
                sfxBus.gain.value = sfxLevel;
            }

            if (musicBus && typeof musicLevel === "number") {
                musicBus.gain.value = musicLevel;
            }
        },

        /* A sound button every page can drop in, so a player
           can always tell whether audio is on. */
        mountToggle: function (parent) {

            var doc = global.document;

            if (!doc || doc.getElementById("hacko-sound-toggle")) {
                return null;
            }

            var button = doc.createElement("button");

            button.id = "hacko-sound-toggle";
            button.type = "button";
            button.style.cssText = [
                "position:fixed", "right:14px", "bottom:14px", "z-index:9999",
                "border:1px solid #367c9d", "border-radius:999px",
                "background:#102742", "color:#eefaff", "cursor:pointer",
                "padding:8px 14px", "font:700 12px Orbitron,sans-serif",
                "box-shadow:0 4px 14px rgba(0,0,0,.45)"
            ].join(";");

            function label() {
                button.textContent = muted ? "SOUND OFF" : "SOUND ON";
                button.style.opacity = muted ? "0.55" : "1";
            }

            button.addEventListener("click", function () {
                HackoAudio.toggleMuted();
                label();
            });

            label();
            (parent || doc.body).appendChild(button);

            return button;
        },

        sounds: Object.keys(SFX),
        tracks: Object.keys(TRACKS)
    };

    global.HackoAudio = HackoAudio;


    /* ---------------------------------------------------
       SELF-START
    --------------------------------------------------- */

    (function autoStart() {

        var doc = global.document;

        if (!doc || !ownScript) {
            return;
        }

        var track = ownScript.getAttribute("data-track");

        function go() {
            try {
                HackoAudio.mountToggle(doc.body);

                if (track) {
                    music.play(track);
                }
            } catch (e) {
                /* audio must never break a page */
            }
        }

        if (doc.readyState === "loading") {
            doc.addEventListener("DOMContentLoaded", go);
        } else {
            go();
        }
    }());

}(window));
