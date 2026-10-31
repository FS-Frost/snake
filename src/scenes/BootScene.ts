import Phaser from "phaser";
import { SCENES } from "../config";
import { createTextures } from "../ui/Background";

export class BootScene extends Phaser.Scene {
    constructor() {
        super(SCENES.boot);
    }

    create(): void {
        createTextures(this);
        this.scene.start(SCENES.menu);
    }
}
