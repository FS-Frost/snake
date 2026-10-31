import Phaser from "phaser";
import { HEIGHT, SCENES, WIDTH } from "../config";
import { debugLog } from "../debug";
import { createTextures } from "../ui/Background";
import { addBloom, isBloomAvailable, setBloomWorks } from "../ui/neon";

/** Frames to render before reading the probe, so the filter pipeline is fully warmed up. */
const PROBE_FRAMES = 2;
/**
 * The probe is mid gray (128), below the bloom threshold, so only the base image can show it:
 * a GPU that drops the base image and keeps just the bloom halo still reads as broken.
 */
const PROBE_COLOR = 0x808080;
const PROBE_MIN_BRIGHTNESS = 64;

export class BootScene extends Phaser.Scene {
    constructor() {
        super(SCENES.boot);
    }

    create(): void {
        createTextures(this);

        if (!isBloomAvailable(this.game)) {
            this.scene.start(SCENES.menu);
            return;
        }

        this.probeBloom();
    }

    /**
     * Renders a small gray square through the bloom filter and reads the center pixel back.
     * On some Android GPUs the filter outputs black; then bloom is disabled for this session.
     */
    private probeBloom(): void {
        this.cameras.main.setBackgroundColor(0x000000);
        this.add.rectangle(WIDTH / 2, HEIGHT / 2, 12, 12, PROBE_COLOR);
        addBloom(this.cameras.main);

        let frames = 0;
        const onPostRender = () => {
            if (++frames < PROBE_FRAMES) {
                return;
            }

            this.game.events.off(Phaser.Core.Events.POST_RENDER, onPostRender);
            const brightness = this.readCenterBrightness();
            const works = brightness >= PROBE_MIN_BRIGHTNESS;
            setBloomWorks(works);
            debugLog(`bloom probe: ${works ? "ok" : "FAILED, bloom disabled"} (read ${brightness}, need ${PROBE_MIN_BRIGHTNESS})`);
            this.scene.start(SCENES.menu);
        };

        this.game.events.on(Phaser.Core.Events.POST_RENDER, onPostRender);
    }

    private readCenterBrightness(): number {
        const renderer = this.game.renderer;

        if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) {
            return 255;
        }

        const gl = renderer.gl;
        const pixel = new Uint8Array(4);
        // Read right after rendering, before the browser composites and may clear the buffer.
        // Phaser 4 tracks GL state itself, so restore whatever framebuffer it had bound.
        const previous = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        gl.bindFramebuffer(gl.FRAMEBUFFER, previous);
        return Math.max(pixel[0], pixel[1], pixel[2]);
    }
}
