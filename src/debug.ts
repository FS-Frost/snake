import Phaser from "phaser";
import { HEIGHT, TOUCH_LAYOUT, WIDTH } from "./config";

/**
 * URL switches for diagnosing device-specific rendering problems:
 *   ?debug=1          on-screen report (DOM, visible even if the canvas renders nothing)
 *   ?bloom=0          skip the bloom filter
 *   ?renderer=canvas  force the Canvas 2D renderer instead of WebGL
 */
const params = new URLSearchParams(window.location.search);

export const DEBUG = {
    overlay: params.get("debug") === "1",
    noBloom: params.get("bloom") === "0",
    forceCanvas: params.get("renderer") === "canvas",
};

const lines: string[] = [];
let panel: HTMLPreElement | null = null;

export function debugLog(line: string): void {
    if (DEBUG.overlay) {
        log(line);
    }
}

function log(line: string): void {
    lines.push(line);
    if (panel) {
        panel.textContent = lines.join("\n");
    }
}

/** Installs the overlay early so boot errors are captured too. */
export function installDebugOverlay(): void {
    if (!DEBUG.overlay) {
        return;
    }

    panel = document.createElement("pre");
    Object.assign(panel.style, {
        position: "fixed",
        top: "0",
        left: "0",
        right: "0",
        margin: "0",
        padding: "8px",
        font: "11px/1.35 monospace",
        color: "#0f0",
        background: "rgba(0,0,0,0.75)",
        zIndex: "10",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        pointerEvents: "none",
    });
    document.body.appendChild(panel);

    window.addEventListener("error", (event) => log(`ERROR ${event.message} @ ${event.filename}:${event.lineno}`));
    window.addEventListener("unhandledrejection", (event) => log(`REJECTION ${String(event.reason)}`));

    log(`UA ${navigator.userAgent}`);
    log(`screen ${window.innerWidth}x${window.innerHeight} dpr=${window.devicePixelRatio} touchLayout=${TOUCH_LAYOUT} logical=${WIDTH}x${HEIGHT}`);
    log(`flags ${JSON.stringify(DEBUG)}`);
}

export function reportRenderer(game: Phaser.Game): void {
    if (!DEBUG.overlay) {
        return;
    }

    const renderer = game.renderer;
    log(`renderer ${renderer.type === Phaser.WEBGL ? "WEBGL" : "CANVAS"} canvas=${game.canvas.width}x${game.canvas.height}`);

    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
        const gl = renderer.gl;
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        const gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        const vendor = info ? gl.getParameter(info.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
        const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        log(`gl ${gl.getParameter(gl.VERSION)}`);
        log(`gpu ${vendor} / ${gpu}`);
        log(`maxTexture=${gl.getParameter(gl.MAX_TEXTURE_SIZE)} fragHighp=${precision?.precision ?? 0} maxTextureUnits=${gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)}`);
        gl.canvas.addEventListener("webglcontextlost", () => log("WEBGL CONTEXT LOST"));
    }

    game.events.on(Phaser.Core.Events.POST_STEP, () => {
        // Once per second: which scenes run, so a black screen can be told apart from a stuck boot.
        if (game.loop.frame % 60 === 0) {
            const scenes = game.scene.getScenes(true).map((scene) => scene.scene.key).join(",");
            const status = `fps=${game.loop.actualFps.toFixed(0)} scenes=${scenes}`;
            if (lines.at(-1)?.startsWith("fps=")) {
                lines[lines.length - 1] = status;
            } else {
                lines.push(status);
            }
            log(lines.pop()!);
        }
    });
}
