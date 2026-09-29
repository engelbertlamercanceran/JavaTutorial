/* =========================================================
   HACKO - shared/badgeart.js
   One design for all ten badges.

       <script src="shared/badgeart.js"></script>
       el.innerHTML = HackoBadgeArt.svg(4);

   The badges used to be ten unrelated images - glossy
   shields, a winged crest, a flat circle with a letter. The
   client asked for them to match, in the style of Dota 2's
   rank medals: every badge is the same medal - metal ring,
   rank stars, a ribbon with its name - and only two things
   change:

     - the emblem in the middle says what the mission taught
     - the metal says how far along the course it is, rising
       from bronze to an "immortal" medal for the final boss,
       with wings, laurels and a crown added as it climbs

   Drawn as inline SVG, so there are no image files to keep
   in step and the badges stay sharp at any size, on screen
   or printed on the certificate.
========================================================= */

(function (global) {
    "use strict";

    /* rim: 4 stops dark -> light -> highlight -> dark
       face: centre -> edge
       glyph: light -> dark */
    var TIERS = [
        {
            name: "BRONZE",
            rim: ["#4a240c", "#b86f33", "#ffd2a6", "#7c4118"],
            face: ["#3d2717", "#120a05"],
            glyph: ["#ffe6cc", "#cf8a4f"],
            ribbon: ["#8a4418", "#5a2a0c"],
            trim: "#2a1406",
            stars: 1
        },
        {
            name: "SILVER",
            rim: ["#343e48", "#a3b1be", "#ffffff", "#667380"],
            face: ["#2a3643", "#0b1016"],
            glyph: ["#ffffff", "#a4b4c4"],
            ribbon: ["#4a5a6b", "#2c3947"],
            trim: "#1a2129",
            stars: 2
        },
        {
            name: "GOLD",
            rim: ["#5a3f06", "#d4a52c", "#fff3b0", "#8f6a12"],
            face: ["#332a12", "#100c04"],
            glyph: ["#fff6cc", "#e0b03c"],
            ribbon: ["#8a6510", "#5a4008"],
            trim: "#2e2003",
            stars: 3,
            wings: 4
        },
        {
            name: "EMERALD",
            rim: ["#0b4433", "#2fbf88", "#d4ffec", "#13694a"],
            face: ["#123a2d", "#04120d"],
            glyph: ["#e6fff4", "#55dea4"],
            ribbon: ["#12664a", "#0a3f2e"],
            trim: "#e0b64a",
            stars: 4,
            wings: 4,
            laurel: true
        },
        {
            name: "DIVINE",
            rim: ["#2c1760", "#8d63ff", "#f1e9ff", "#4f2fab"],
            face: ["#2a1752", "#0a0518"],
            glyph: ["#f6f0ff", "#b59bff"],
            ribbon: ["#4b2aa6", "#2c176a"],
            trim: "#e0b64a",
            stars: 5,
            wings: 5,
            laurel: true,
            rays: true
        },
        {
            name: "IMMORTAL",
            rim: ["#560912", "#d9364a", "#ffd9de", "#8a1222"],
            face: ["#420a13", "#130205"],
            glyph: ["#fff4c2", "#eaa935"],
            ribbon: ["#a3162a", "#5e0a16"],
            trim: "#f0c24e",
            stars: 0,
            wings: 6,
            laurel: true,
            rays: true,
            crown: true
        }
    ];

    /* mission -> rank. Two missions per rank, then the last
       two stand alone at the top. */
    var MISSION_TIER = {
        1: 0, 2: 0,
        3: 1, 4: 1,
        5: 2, 6: 2,
        7: 3, 8: 3,
        9: 4,
        10: 5
    };

    var NAMES = {
        1: "VARIABLE HERO",
        2: "CODE MESSENGER",
        3: "DECISION MASTER",
        4: "LOOP RUNNER",
        5: "ARRAY EXPLORER",
        6: "FUNCTION KNIGHT",
        7: "BUG SLAYER",
        8: "OBJECT HERO",
        9: "LOGIC MASTER",
        10: "LOOP LEGEND"
    };


    /* ---------------------------------------------------
       EMBLEMS - drawn in a 100 x 100 box.
       G = the metal fill, S = outline, D = the face colour
       (for cut-outs), one per mission.
    --------------------------------------------------- */

    function outlined(d, G, S, width) {
        return "<path d='" + d + "' fill='none' stroke='" + S + "' stroke-width='" + (width + 7) +
            "' stroke-linecap='round' stroke-linejoin='round'/>" +
            "<path d='" + d + "' fill='none' stroke='" + G + "' stroke-width='" + width +
            "' stroke-linecap='round' stroke-linejoin='round'/>";
    }

    function solid(tag, attrs, G, S) {
        return "<" + tag + " " + attrs + " fill='" + G + "' stroke='" + S +
            "' stroke-width='3' stroke-linejoin='round'/>";
    }

    var EMBLEMS = {

        /* a labelled box: a variable holds a value */
        1: function (G, S, D) {
            return solid("rect", "x='16' y='30' width='68' height='54' rx='8'", G, S) +
                solid("rect", "x='11' y='20' width='78' height='15' rx='5'", G, S) +
                "<text x='50' y='76' text-anchor='middle' font-family='Georgia,serif' " +
                "font-style='italic' font-weight='700' font-size='42' fill='" + D + "'>x</text>";
        },

        /* an envelope: input and output */
        2: function (G, S, D) {
            return solid("rect", "x='9' y='24' width='82' height='56' rx='7'", G, S) +
                "<path d='M13 29 L50 58 L87 29' fill='none' stroke='" + D +
                "' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/>" +
                "<path d='M13 76 L38 52 M87 76 L62 52' fill='none' stroke='" + D +
                "' stroke-width='3' stroke-linecap='round'/>";
        },

        /* a path that splits in two: if / else */
        3: function (G, S) {
            return outlined("M50 92 V58 L27 34 M50 58 L73 34", G, S, 11) +
                solid("path", "d='M12 18 L37 25 L19 43 Z'", G, S) +
                solid("path", "d='M88 18 L63 25 L81 43 Z'", G, S);
        },

        /* an arrow that comes back round: a loop */
        4: function (G, S) {
            return outlined("M78 52 A28 28 0 1 1 64 27.8", G, S, 11) +
                solid("path", "d='M79 36 L56 39 L70 17 Z'", G, S);
        },

        /* brackets holding cells: an array */
        5: function (G, S) {
            return outlined("M19 18 H9 V82 H19 M81 18 H91 V82 H81", G, S, 8) +
                solid("rect", "x='21' y='40' width='16' height='20' rx='3'", G, S) +
                solid("rect", "x='42' y='40' width='16' height='20' rx='3'", G, S) +
                solid("rect", "x='63' y='40' width='16' height='20' rx='3'", G, S);
        },

        /* a sword: the function knight */
        6: function (G, S, D) {
            return solid("path", "d='M50 6 L59 19 L59 64 L41 64 L41 19 Z'", G, S) +
                "<path d='M50 18 V60' stroke='" + D + "' stroke-width='3' stroke-linecap='round'/>" +
                solid("rect", "x='24' y='62' width='52' height='10' rx='5'", G, S) +
                solid("rect", "x='44.5' y='72' width='11' height='15' rx='3'", G, S) +
                solid("circle", "cx='50' cy='91' r='6'", G, S);
        },

        /* a bug: debugging */
        7: function (G, S, D) {
            return outlined(
                "M34 46 L16 37 M33 58 L12 58 M34 70 L17 81 " +
                "M66 46 L84 37 M67 58 L88 58 M66 70 L83 81 " +
                "M45 23 Q40 11 31 8 M55 23 Q60 11 69 8", G, S, 5) +
                solid("ellipse", "cx='50' cy='60' rx='19' ry='26'", G, S) +
                solid("circle", "cx='50' cy='30' r='11'", G, S) +
                "<path d='M50 40 V83' stroke='" + D + "' stroke-width='3'/>";
        },

        /* a cube: an object */
        8: function (G, S) {
            return solid("path", "d='M50 12 L86 31 L50 50 L14 31 Z'", G, S) +
                solid("path", "d='M14 31 L50 50 L50 92 L14 73 Z'", G, S) +
                solid("path", "d='M86 31 L50 50 L50 92 L86 73 Z'", G, S) +
                "<path d='M14 31 L50 50 L50 92 L14 73 Z' fill='#000' opacity='.22'/>" +
                "<path d='M86 31 L50 50 L50 92 L86 73 Z' fill='#000' opacity='.4'/>";
        },

        /* a decision inside a decision: nested conditions */
        9: function (G, S, D) {
            return solid("path", "d='M50 5 L95 50 L50 95 L5 50 Z'", G, S) +
                "<path d='M50 24 L76 50 L50 76 L24 50 Z' fill='" + D + "'/>" +
                solid("path", "d='M50 38 L62 50 L50 62 L38 50 Z'", G, S);
        },

        /* infinity: the loop legend */
        10: function (G, S) {
            return outlined(
                "M50 50 C36 26 9 30 9 50 C9 70 36 74 50 50 " +
                "C64 26 91 30 91 50 C91 70 64 74 50 50 Z", G, S, 11);
        }
    };


    /* ---------------------------------------------------
       PIECES OF THE MEDAL
       The medal is centred on (120, 112) in a 240 x 240 box.
    --------------------------------------------------- */

    var CX = 120;
    var CY = 112;

    function star(cx, cy, r, fill, stroke) {
        var points = [];
        for (var i = 0; i < 10; i++) {
            var radius = i % 2 ? r * 0.45 : r;
            var angle = -Math.PI / 2 + i * Math.PI / 5;
            points.push(
                (cx + radius * Math.cos(angle)).toFixed(1) + "," +
                (cy + radius * Math.sin(angle)).toFixed(1)
            );
        }
        return "<polygon points='" + points.join(" ") + "' fill='" + fill +
            "' stroke='" + stroke + "' stroke-width='1.6' stroke-linejoin='round'/>";
    }

    function wings(tier, id) {

        var out = "";
        var count = tier.wings;

        [-1, 1].forEach(function (side) {
            for (var i = 0; i < count; i++) {
                var angle = -58 + i * (88 / (count - 1));
                var length = 74 - Math.abs(angle + 14) * 0.35;
                out += "<path d='M0 0 Q" + (length * 0.45) + " -19 " + length + " 0 Q" +
                    (length * 0.55) + " 15 0 0 Z' fill='url(#" + id + "wing)' stroke='" +
                    tier.rim[0] + "' stroke-width='2' transform='translate(" +
                    (CX + side * 50) + " " + (CY + 4) + ") scale(" + side + " 1) rotate(" +
                    angle + ")'/>";
            }
        });

        return out;
    }

    function laurel() {

        var out = "";

        [-1, 1].forEach(function (side) {
            for (var i = 0; i < 7; i++) {
                /* round the lower half of the ring */
                var deg = 100 + i * 12;
                var rad = deg * Math.PI / 180;
                var x = CX + side * -Math.cos(rad) * 90;
                var y = CY + Math.sin(rad) * 90;
                var tilt = side * (deg - 90 + 35);
                out += "<ellipse cx='" + x.toFixed(1) + "' cy='" + y.toFixed(1) +
                    "' rx='11' ry='4.6' fill='#e3b544' stroke='#6b4a08' stroke-width='1.4' " +
                    "transform='rotate(" + tilt.toFixed(1) + " " + x.toFixed(1) + " " + y.toFixed(1) + ")'/>";
            }
        });

        return out;
    }

    function rays(tier) {

        var points = [];
        var spikes = 18;

        for (var i = 0; i < spikes * 2; i++) {
            var r = i % 2 ? 84 : 101;
            var a = i * Math.PI / spikes;
            points.push(
                (CX + r * Math.cos(a)).toFixed(1) + "," +
                (CY + r * Math.sin(a)).toFixed(1)
            );
        }

        return "<polygon points='" + points.join(" ") + "' fill='" + tier.rim[1] +
            "' stroke='" + tier.rim[0] + "' stroke-width='2' opacity='.9'/>";
    }

    function crown(id) {
        return "<path d='M90 44 L84 16 L104 30 L120 6 L136 30 L156 16 L150 44 Z' " +
            "fill='url(#" + id + "gold)' stroke='#5a3a04' stroke-width='3' stroke-linejoin='round'/>" +
            "<circle cx='120' cy='30' r='5' fill='#e0243c' stroke='#5a0a14' stroke-width='1.5'/>" +
            "<circle cx='100' cy='36' r='3.5' fill='#e0243c' stroke='#5a0a14' stroke-width='1.2'/>" +
            "<circle cx='140' cy='36' r='3.5' fill='#e0243c' stroke='#5a0a14' stroke-width='1.2'/>";
    }

    function ribbon(tier, id, name) {

        var fit = name.length > 12
            ? " textLength='150' lengthAdjust='spacingAndGlyphs'"
            : "";

        return "<path d='M12 184 L40 184 L40 214 L12 214 L22 199 Z' fill='" + tier.ribbon[1] +
            "' stroke='" + tier.trim + "' stroke-width='2' stroke-linejoin='round'/>" +
            "<path d='M228 184 L200 184 L200 214 L228 214 L218 199 Z' fill='" + tier.ribbon[1] +
            "' stroke='" + tier.trim + "' stroke-width='2' stroke-linejoin='round'/>" +
            "<path d='M30 178 Q120 168 210 178 L210 208 Q120 198 30 208 Z' fill='url(#" + id +
            "ribbon)' stroke='" + tier.trim + "' stroke-width='2.5' stroke-linejoin='round'/>" +
            "<text x='120' y='198' text-anchor='middle' font-family='Orbitron,Arial Black,sans-serif' " +
            "font-weight='900' font-size='14' letter-spacing='1' fill='#fff' stroke='#000' " +
            "stroke-width='3' paint-order='stroke'" + fit + ">" + name + "</text>";
    }


    /* ---------------------------------------------------
       THE MEDAL
    --------------------------------------------------- */

    var counter = 0;

    function svg(missionId, options) {

        var n = Number(missionId);
        var tier = TIERS[MISSION_TIER[n]];
        var draw = EMBLEMS[n];

        if (!tier || !draw) {
            return "";
        }

        var opts = options || {};
        var name = NAMES[n];
        var id = "hkb" + (++counter) + "_";
        var title = opts.title === false ? "" : "<title>" + name + " - " + tier.name + " badge</title>";

        var defs =
            "<defs>" +
                "<linearGradient id='" + id + "rim' x1='0' y1='0' x2='1' y2='1'>" +
                    "<stop offset='0' stop-color='" + tier.rim[2] + "'/>" +
                    "<stop offset='.35' stop-color='" + tier.rim[1] + "'/>" +
                    "<stop offset='.7' stop-color='" + tier.rim[3] + "'/>" +
                    "<stop offset='1' stop-color='" + tier.rim[0] + "'/>" +
                "</linearGradient>" +
                "<linearGradient id='" + id + "rim2' x1='1' y1='1' x2='0' y2='0'>" +
                    "<stop offset='0' stop-color='" + tier.rim[2] + "'/>" +
                    "<stop offset='.5' stop-color='" + tier.rim[1] + "'/>" +
                    "<stop offset='1' stop-color='" + tier.rim[0] + "'/>" +
                "</linearGradient>" +
                "<radialGradient id='" + id + "face' cx='.5' cy='.38' r='.7'>" +
                    "<stop offset='0' stop-color='" + tier.face[0] + "'/>" +
                    "<stop offset='1' stop-color='" + tier.face[1] + "'/>" +
                "</radialGradient>" +
                "<linearGradient id='" + id + "glyph' x1='0' y1='0' x2='0' y2='1'>" +
                    "<stop offset='0' stop-color='" + tier.glyph[0] + "'/>" +
                    "<stop offset='1' stop-color='" + tier.glyph[1] + "'/>" +
                "</linearGradient>" +
                "<linearGradient id='" + id + "ribbon' x1='0' y1='0' x2='0' y2='1'>" +
                    "<stop offset='0' stop-color='" + tier.ribbon[0] + "'/>" +
                    "<stop offset='1' stop-color='" + tier.ribbon[1] + "'/>" +
                "</linearGradient>" +
                "<linearGradient id='" + id + "wing' x1='0' y1='0' x2='1' y2='0'>" +
                    "<stop offset='0' stop-color='" + tier.rim[3] + "'/>" +
                    "<stop offset='1' stop-color='" + tier.rim[2] + "'/>" +
                "</linearGradient>" +
                "<linearGradient id='" + id + "gold' x1='0' y1='0' x2='0' y2='1'>" +
                    "<stop offset='0' stop-color='#fff3b0'/>" +
                    "<stop offset='1' stop-color='#c8911c'/>" +
                "</linearGradient>" +
            "</defs>";

        var G = "url(#" + id + "glyph)";
        var S = "#07060a";
        var D = tier.face[1];

        var starRow = "";
        for (var i = 0; i < tier.stars; i++) {
            var a = (-90 + (i - (tier.stars - 1) / 2) * 15) * Math.PI / 180;
            starRow += star(
                CX + Math.cos(a) * 75, CY + Math.sin(a) * 75, 7.5,
                "url(#" + id + "gold)", "#3a2600"
            );
        }

        var body =
            (tier.wings ? wings(tier, id) : "") +
            (tier.rays ? rays(tier) : "") +
            (tier.laurel ? laurel() : "") +
            /* the ring: outer trim, bevelled rim, face */
            "<circle cx='" + CX + "' cy='" + CY + "' r='82' fill='" + tier.trim + "'/>" +
            "<circle cx='" + CX + "' cy='" + CY + "' r='79' fill='url(#" + id + "rim)'/>" +
            "<circle cx='" + CX + "' cy='" + CY + "' r='68' fill='url(#" + id + "rim2)'/>" +
            "<circle cx='" + CX + "' cy='" + CY + "' r='63' fill='url(#" + id + "face)' stroke='" +
                tier.rim[0] + "' stroke-width='2'/>" +
            "<circle cx='" + CX + "' cy='" + CY + "' r='52' fill='none' stroke='" + tier.glyph[1] +
                "' stroke-opacity='.18' stroke-width='1.5'/>" +
            /* the shine across the top of the face */
            "<path d='M66 96 A56 56 0 0 1 174 96 Q120 80 66 96 Z' fill='#fff' opacity='.07'/>" +
            "<g transform='translate(" + (CX - 38) + " " + (CY - 40) + ") scale(.76)'>" +
                draw(G, S, D) +
            "</g>" +
            starRow +
            (tier.crown ? crown(id) : "") +
            (opts.ribbon === false ? "" : ribbon(tier, id, name));

        return "<svg class='hk-badge-art' viewBox='0 0 240 230' xmlns='http://www.w3.org/2000/svg' " +
            "role='img' aria-label='" + name + " badge'>" + title + defs + body + "</svg>";
    }

    function tierOf(missionId) {
        var tier = TIERS[MISSION_TIER[Number(missionId)]];
        return tier ? tier.name : "";
    }

    global.HackoBadgeArt = {
        svg: svg,
        tierOf: tierOf,
        NAMES: NAMES,
        TIERS: TIERS.map(function (t) { return t.name; })
    };

}(window));
