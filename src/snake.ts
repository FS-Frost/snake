import Game from "./game";
import Static from "./static";

let p: p5;

class Snake {
    body: p5.Vector[];
    private velocity: p5.Vector;
    private speed: number;
    private size: number;
    private framesToMove: number;
    private readonly maxFramesToMove = 2;

    constructor(x: number, y: number, size: number) {
        p = Static.getP5();
        this.framesToMove = 5;
        this.speed = Game.CELL_SIZE;
        this.velocity = p.createVector(this.speed, 0);
        this.size = size;
        this.body = [];

        for (let i = 0; i < this.size; i++) {
            const _x = x + i * Game.CELL_SIZE;
            const position = p.createVector(_x, y);
            this.body.push(position);
        }
    }

    update() {
        this.checkInput();
        this.updatePosition();
        this.checkBoundaries();
    }

    getHead(): p5.Vector {
        return this.body[0];
    }

    checkInput() {
        let newVelocity = this.velocity.copy();

        if (p.keyCode == p.UP_ARROW) {
            newVelocity = p.createVector(0, -this.speed);
        }

        if (p.keyCode == p.DOWN_ARROW) {
            newVelocity = p.createVector(0, this.speed);
        }

        if (p.keyCode == p.LEFT_ARROW) {
            newVelocity = p.createVector(-this.speed, 0);
        }

        if (p.keyCode == p.RIGHT_ARROW) {
            newVelocity = p.createVector(this.speed, 0);
        }

        const isOpposite = -newVelocity.x == this.velocity.x || -newVelocity.y == this.velocity.y;

        if (isOpposite) {
            return;
        }

        this.velocity = newVelocity;
    }

    updatePosition() {
        if (p.frameCount % this.framesToMove == 0) {
            const newHead = this.getHead().copy().add(this.velocity);
            const hasGrown = this.body.length != this.size;

            if (!hasGrown) {
                this.body.pop();
            }

            this.body.unshift(newHead);
        }
    }

    checkBoundaries() {
        const head = this.getHead();

        if (head.x == Game.WIDTH) {
            head.x = 0;
            return;
        }

        if (head.y == Game.HEIGHT) {
            head.y = 0;
            return;
        }

        if (head.x < 0) {
            head.x = Game.WIDTH - Game.CELL_SIZE;
            return;
        }

        if (head.y < 0) {
            head.y = Game.HEIGHT - Game.CELL_SIZE;
            return;
        }
    }

    grow() {
        this.size++;

        if (this.framesToMove > this.maxFramesToMove) {
            this.framesToMove--;
        }
    }

    show() {
        p.fill("green");

        for (let i = 0; i < this.body.length; i++) {
            const { x, y } = this.body[i];
            p.rect(x, y, Game.CELL_SIZE, Game.CELL_SIZE);
        }
    }
}

export default Snake;
