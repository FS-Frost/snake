import Phaser from "phaser";
import { theme } from "../theme";
import { vibrate } from "./neon";

/**
 * Framed pause button with a drawn "II" icon, styled like the D-pad keys (rounded in Neon,
 * hard-edged in Old School). A bare "II" glyph did not read as a button on phones.
 */
export function pauseButton(scene: Phaser.Scene, x: number, y: number, size: number, onPress: () => void): Phaser.GameObjects.Graphics {
    const style = theme();
    const half = size / 2;
    const radius = style.pixel ? 0 : Math.round(size * 0.16);

    const button = scene.add.graphics({ x, y });
    button.fillStyle(style.board, 0.9);
    button.fillRoundedRect(-half, -half, size, size, radius);
    button.lineStyle(style.pixel ? 4 : 3, style.text.primary, 1);
    button.strokeRoundedRect(-half, -half, size, size, radius);

    // Two vertical bars.
    const barW = Math.round(size * 0.14);
    const barH = Math.round(size * 0.46);
    const gap = Math.round(size * 0.12);
    button.fillStyle(style.text.primary, 1);
    button.fillRect(-gap / 2 - barW, -barH / 2, barW, barH);
    button.fillRect(gap / 2, -barH / 2, barW, barH);

    const flash = scene.add.graphics({ x, y }).setAlpha(0);
    flash.fillStyle(style.text.primary, 1);
    flash.fillRoundedRect(-half, -half, size, size, radius);

    // Touch target a bit larger than the drawn key.
    const hit = half + 10;
    button.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-hit, -hit, hit * 2, hit * 2),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
    });
    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        flash.setAlpha(0.45);
        scene.tweens.add({ targets: flash, alpha: 0, duration: 160 });
        vibrate(8);
    });
    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onPress);
    return button;
}
