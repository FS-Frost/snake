import Game from "./game";
import Static from "./static";

let p: p5;

class Snake {
    body: p5.Vector[];
    onDeath: () => void;
    private velocity: p5.Vector;
    private speed: number;
    private size: number;
    private framesToMove: number;
    private readonly maxFramesToMove = 2;

    constructor(x: number, y: number, size: number) {
        p = Static.getP5();
        this.framesToMove = 15;
        this.speed = Game.CELL_SIZE;
        this.velocity = p.createVector(this.speed, 0);
        this.size = size;
        this.body = [];

        for (let i = 0; i < this.size; i++) {
            const _x = x - i * Game.CELL_SIZE;
            const position = p.createVector(_x, y);
            this.body.push(position);
        }
    }

    update() {
        if (p.frameCount % this.framesToMove != 0) {
            return;
        }

        this.updateDirection();
        this.updatePosition();
        this.checkBoundaries();
    }

    getHead(): p5.Vector {
        return this.body[0];
    }

    updateDirection() {
        let newVelocity = this.velocity.copy();

        switch (p.keyCode) {
            case p.UP_ARROW:
                newVelocity = p.createVector(0, -this.speed);
                break;
            case p.DOWN_ARROW:
                newVelocity = p.createVector(0, this.speed);
                break;
            case p.LEFT_ARROW:
                newVelocity = p.createVector(-this.speed, 0);
                break;
            case p.RIGHT_ARROW:
                newVelocity = p.createVector(this.speed, 0);
                break;
        }

        const isOpposite = -newVelocity.x == this.velocity.x || -newVelocity.y == this.velocity.y;

        if (isOpposite) {
            return;
        }

        this.velocity = newVelocity;
    }

    hitsBody(newHead: p5.Vector) {
        let isDead = false;

        for (let i = 1; i < this.body.length; i++) {
            const slice = this.body[i];
            isDead = p.dist(slice.x, slice.y, newHead.x, newHead.y) == 0;

            if (isDead) {
                break;
            }
        }

        return isDead;
    }

    updatePosition() {
        const newHead = this.getHead().copy().add(this.velocity);
        const hasGrown = this.body.length != this.size;

        if (!hasGrown) {
            this.body.pop();
        }

        if (this.hitsBody(newHead)) {
            this.onDeath();
            return;
        }

        this.body.unshift(newHead);
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

    intersects(x: number, y: number) {
        let intersects = false;

        for (let i = 0; i < this.body.length; i++) {
            const { x: bodyX, y: bodyY } = this.body[i];
            intersects = x == bodyX && y == bodyY;

            if (intersects) {
                break;
            }
        }

        return intersects;
    }

    grow() {
        this.size++;

        if (this.framesToMove > this.maxFramesToMove) {
            this.framesToMove--;
        }
    }

    show() {
        for (let i = 0; i < this.body.length; i++) {
            p.fill(i == 0 ? "blue" : "green");

            const { x, y } = this.body[i];
            p.rect(x, y, Game.CELL_SIZE, Game.CELL_SIZE);
        }
    }
}

export default Snake;
