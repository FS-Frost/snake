import { chromium } from "playwright-core";

/**
 * Text layout audit: opens every scene in every style, on desktop, two portrait phones and a
 * landscape phone, in both languages, and reports texts that leave the screen or overlap another
 * text of the same scene. Exits with code 1 when anything is found.
 *
 * Usage: start the dev server (`bun run dev`), then `bun run audit:text`.
 *   AUDIT_URL      default http://localhost:5000/
 *   BROWSER        installed browser channel for Playwright, default "msedge" (or "chrome")
 *   --shots DIR    also save a screenshot of every checked screen into DIR
 */
const URL = process.env.AUDIT_URL ?? "http://localhost:5000/";
const shotsIndex = process.argv.indexOf("--shots");
const out = shotsIndex > 0 ? process.argv[shotsIndex + 1] : null;
const onlyShots = out !== null;
const b = await chromium.launch({ channel: process.env.BROWSER ?? "msedge", args: ["--ignore-gpu-blocklist"] });

const SCREENS = [
    { tag: "desktop", viewport: { width: 900, height: 1000 }, mobile: false },
    { tag: "phone360", viewport: { width: 360, height: 740 }, mobile: true },
    { tag: "phone390", viewport: { width: 390, height: 844 }, mobile: true },
    { tag: "land844", viewport: { width: 844, height: 390 }, mobile: true },
];
const STYLES = ["neon", "gameboy", "nokia", "console"];
const LANGS = ["es", "en"];

const audit = (sceneKey) => {
    const s = window.game.scene.getScene(sceneKey);
    const cam = s.cameras.main;
    const W = cam.worldView.width, H = cam.worldView.height;
    const texts = s.children.list
        .filter((o) => o.type === "Text" && o.visible && o.alpha > 0.05 && o.text.trim() !== "")
        .map((o) => ({ t: o.text.replace(/\n/g, " ").slice(0, 32), b: o.getBounds(), pad: o.padding }));
    // Text bounds include glow padding; shrink to the glyph box for a fair test.
    const glyph = ({ b, pad }) => ({ l: b.left + (pad?.left ?? 0) * 0.9, r: b.right - (pad?.right ?? 0) * 0.9, t: b.top + (pad?.top ?? 0) * 0.9, bo: b.bottom - (pad?.bottom ?? 0) * 0.9 });
    const issues = [];
    for (const x of texts) {
        const g = glyph(x);
        if (g.l < 0 || g.r > W || g.t < 0 || g.bo > H) issues.push(`OUT "${x.t}" [${Math.round(g.l)},${Math.round(g.t)}..${Math.round(g.r)},${Math.round(g.bo)}] screen ${Math.round(W)}x${Math.round(H)}`);
    }
    for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) {
            if (texts[i].t === texts[j].t) continue; // Intentional layered copies (title ghosts).
            const a = glyph(texts[i]), c = glyph(texts[j]);
            const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l);
            const oy = Math.min(a.bo, c.bo) - Math.max(a.t, c.t);
            if (ox > 2 && oy > 2) issues.push(`OVERLAP "${texts[i].t}" x "${texts[j].t}" (${Math.round(ox)}x${Math.round(oy)})`);
        }
    }
    return issues;
};

let total = 0;
for (const screen of SCREENS) {
    for (const style of STYLES) {
        for (const lang of LANGS) {
            const ctx = await b.newContext({ viewport: screen.viewport, deviceScaleFactor: 2, isMobile: screen.mobile, hasTouch: screen.mobile });
            await ctx.addInitScript(([s, l]) => localStorage.setItem("snake.v2", JSON.stringify({ settings: { language: l, styleChosen: true, style: s, touch: "dpad", dpadSide: "right" }, highScores: { "wrap:normal": 123450 } })), [style, lang]);
            const p = await ctx.newPage();
            p.on("pageerror", (e) => console.log("pageerror", e.message));
            await p.goto(URL);
            await p.waitForTimeout(1000);
            await p.keyboard.press("Space");
            await p.waitForTimeout(400);
            const report = {};
            const run = async (name, setup, sceneKey, wait = 500) => {
                await p.evaluate(setup);
                await p.waitForTimeout(wait);
                report[name] = await p.evaluate(audit, sceneKey);
                if (onlyShots) await p.screenshot({ path: `${out}/ov-${screen.tag}-${style}-${lang}-${name}.png` });
            };

            await run("menu", () => {}, "Menu");
            await run("settings", () => window.game.scene.getScene("Menu").scene.launch("Settings", { from: "Menu", fromMenu: true }), "Settings");
            await run("fonoteca", () => { window.game.scene.stop("Settings"); window.game.scene.getScene("Menu").scene.start("Fonoteca"); }, "Fonoteca", 700);
            await run("message", () => {
                window.game.scene.getScene("Fonoteca").scene.start("Menu");
                setTimeout(() => window.game.scene.getScene("Menu").scene.launch("Message", { from: "Menu", title: "INSTALAR APP", lines: ["1. Toca COMPARTIR en la barra de Safari", "2. Elige AGREGAR A INICIO", "3. Abre SNAKE desde tu pantalla de inicio: pantalla completa y sin conexión"] }), 300);
            }, "Message", 900);
            await run("game", () => {
                window.game.scene.stop("Message");
                window.game.scene.getScene("Menu").scene.start("Game", { mode: "classic", difficulty: "normal" });
            }, "Game", 2600);
            // Worst-case HUD: big score, combo, both effects, long time.
            await run("game-busy", () => {
                const g = window.game.scene.getScene("Game");
                const l = g.logic;
                l.score = 98760; l.combo = 5; l.foodsEaten = 44;
                l.effects.slowmo = l.clock + 4000; l.effects.ghost = l.clock + 4000;
                l.clock += 0; g.elapsedMs = 3599000;
                l.lastPickupAt = l.clock;
                l["lastPickupAt"] = l.clock;
            }, "Game", 300);
            await run("pause", () => window.game.scene.getScene("Game").pause(), "Pause", 400);
            await run("gameover", () => {
                window.game.scene.stop("Pause");
                const g = window.game.scene.getScene("Game");
                g.scene.launch("GameOver", { settings: { mode: "classic", difficulty: "normal" }, score: 98760, best: 123450, isRecord: true, won: false, length: 120, level: 12, timeMs: 3599000 });
                g.scene.pause();
            }, "GameOver", 2200);

            const lines = Object.entries(report).flatMap(([scene, issues]) => issues.map((i) => `  [${scene}] ${i}`));
            total += lines.length;
            if (lines.length) console.log(`${screen.tag} ${style} ${lang}:\n${lines.join("\n")}`);
            await ctx.close();
        }
    }
}
console.log("TOTAL ISSUES:", total);
await b.close();
process.exit(total > 0 ? 1 : 0);
