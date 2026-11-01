import Phaser from "phaser";
import { HEIGHT, SCENES, WIDTH } from "../config";
import { t } from "../i18n";
import { MenuList } from "../ui/MenuList";
import { applyNeonPost, gameText } from "../ui/neon";
import { createBackdrop } from "../ui/overlay";

export interface MessageSceneData {
    /** Scene that opened the message; it is paused meanwhile and resumed on close. */
    from: string;
    title: string;
    lines: string[];
}

/** In-game message box (used for the iOS install steps), so nothing ever falls back to a browser dialog. */
export class MessageScene extends Phaser.Scene {
    constructor() {
        super(SCENES.message);
    }

    create(data: MessageSceneData): void {
        createBackdrop(this, 0.92, true);

        const title = gameText(this, WIDTH / 2, HEIGHT * 0.26, data.title, { size: 44, weight: 900, color: "primary", glow: 18 });
        // Lines are top-anchored so wrapped (multi-line) steps push the next one down.
        let y = title.y + 70;
        for (const line of data.lines) {
            const text = gameText(this, WIDTH / 2, y, line, { size: 20, color: "text", glow: 0, weight: 400 })
                .setWordWrapWidth(Math.min(WIDTH, 720) - 100)
                .setAlign("center")
                .setOrigin(0.5, 0);
            y += text.height + 20;
        }

        const close = () => {
            this.scene.resume(data.from);
            this.scene.stop();
        };
        new MenuList(this, WIDTH / 2, y + 50, [{ label: () => t("back"), onSelect: close }], { onBack: close });

        applyNeonPost(this);
    }
}
