import Game from "./game";
import Static from "./static";

let p: p5;

class Food {
    position: p5.Vector;
    private size: number;

    constructor(x: number, y: number) {
        p = Static.getP5();
        this.position = p.createVector(x, y);
        this.size = Game.CELL_SIZE;
    }

    update() {}

    show() {
        p.fill("red");
        p.rect(this.position.x, this.position.y, this.size, this.size);
    }
}

export default Food;
