import Phaser from "phaser";
import { audio } from "../audio/Audio";
import { theme } from "../theme";
import { gameText, setTextRole } from "./neon";

export interface MenuItem {
    label: () => string;
    /** ENTER / click. */
    onSelect?: () => void;
    /** LEFT / RIGHT on option items. Click cycles forward. */
    onChange?: (delta: -1 | 1) => void;
}

export interface MenuListOptions {
    spacing?: number;
    size?: number;
    /** Called whenever focus moves or a value changes (dependent labels). */
    onUpdate?: () => void;
    /** ESC / Backspace. */
    onBack?: () => void;
    /** Initially focused item. */
    focus?: number;
}

/**
 * Vertical in-canvas menu driven by keyboard, mouse and touch.
 */
export class MenuList {
    private readonly scene: Phaser.Scene;
    private readonly items: MenuItem[];
    private readonly texts: Phaser.GameObjects.Text[];
    private readonly onUpdate?: () => void;
    private readonly onBack?: () => void;
    private focus = 0;
    private enabled = true;

    constructor(scene: Phaser.Scene, x: number, y: number, items: MenuItem[], options: MenuListOptions = {}) {
        const { spacing = 64, size = 30 } = options;
        this.scene = scene;
        this.items = items;
        this.onUpdate = options.onUpdate;
        this.onBack = options.onBack;
        this.focus = Math.max(0, Math.min(items.length - 1, options.focus ?? 0));

        this.texts = items.map((item, index) => {
            const text = gameText(scene, x, y + index * spacing, item.label(), { size, glow: 10 });
            text.setInteractive({ useHandCursor: true });
            text.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.setFocus(index));
            text.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (_pointer: Phaser.Input.Pointer, localX: number) => {
                this.setFocus(index);
                // On option items the left half decreases and the right half increases, like the "<" ">" arrows.
                this.activate(item.onChange && localX < text.width / 2 ? -1 : 1);
            });
            return text;
        });

        scene.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKey, this);
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            scene.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKey, this);
        });

        this.render();
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    refresh(): void {
        this.render();
    }

    private handleKey(event: KeyboardEvent): void {
        if (!this.enabled) {
            return;
        }

        switch (event.code) {
            case "ArrowUp":
            case "KeyW":
                this.setFocus((this.focus - 1 + this.items.length) % this.items.length);
                break;
            case "ArrowDown":
            case "KeyS":
                this.setFocus((this.focus + 1) % this.items.length);
                break;
            case "ArrowLeft":
            case "KeyA":
                this.change(-1);
                break;
            case "ArrowRight":
            case "KeyD":
                this.change(1);
                break;
            case "Enter":
            case "NumpadEnter":
            case "Space":
                this.activate(1);
                break;
            case "Escape":
            case "Backspace":
                if (this.onBack) {
                    audio.uiBack();
                    this.onBack();
                }
                break;
        }
    }

    private setFocus(index: number): void {
        if (index === this.focus || !this.enabled) {
            return;
        }

        this.focus = index;
        audio.uiMove();
        this.render();
        this.onUpdate?.();
    }

    private change(delta: -1 | 1): void {
        const item = this.items[this.focus];

        if (!item.onChange) {
            return;
        }

        item.onChange(delta);
        audio.uiMove();
        this.render();
        this.onUpdate?.();

        const text = this.texts[this.focus];
        this.scene.tweens.add({ targets: text, x: text.x + delta * 8, duration: 60, yoyo: true });
    }

    private activate(delta: -1 | 1): void {
        if (!this.enabled) {
            return;
        }

        const item = this.items[this.focus];

        if (item.onChange) {
            this.change(delta);
            return;
        }

        const text = this.texts[this.focus];
        this.scene.tweens.add({ targets: text, scale: 1.15, duration: 80, yoyo: true });
        audio.uiSelect();
        item.onSelect?.();
    }

    private render(): void {
        this.items.forEach((item, index) => {
            const text = this.texts[index];
            const focused = index === this.focus;
            // Pixel palettes may have a single ink color, so focus must also show through the markers:
            // there, arrows appear only on the focused item.
            const showArrows = item.onChange && (focused || !theme().pixel);
            const label = showArrows ? `<  ${item.label()}  >` : item.label();

            text.setText(focused && !item.onChange ? `>  ${label}  <` : label);
            setTextRole(text, focused ? "primary" : "dim", focused ? 16 : 0);
            text.setAlpha(focused ? 1 : 0.6);
        });
    }
}
