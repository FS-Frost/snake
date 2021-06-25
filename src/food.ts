import Game from "./game";
import Static from "./static";

let p: p5;

class Food {
    position: p5.Vector;

    constructor(x: number, y: number) {
        p = Static.getP5();
        this.position = p.createVector(x, y);
    }

    update() {}

    show() {
        p.fill("red");
        const offset = Game.CELL_SIZE / 2;
        const x = this.position.x + offset;
        const y = this.position.y + offset;
        const d = Game.CELL_SIZE * 0.8;
        p.circle(x, y, d);
    }
}

export default Food;
