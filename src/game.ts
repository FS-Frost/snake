import Food from "./food";
import Grid from "./grid";
import Snake from "./snake";
import Static from "./static";

let p: p5;

class Game {
    static readonly WIDTH = 500;
    static readonly HEIGHT = 500;
    static readonly CELL_SIZE = 25;
    static readonly MIN_FPS = 4;
    static readonly MAX_FPS = 60;
    private readonly _logX = 15;
    private _logY: number;

    fps: number;
    grid: Grid;
    snake: Snake;
    food: Food;
    playTimeInMs: number;
    score: number;
    pDebug: p5.Element;
    pScore: p5.Element;
    pSpeed: p5.Element;
    pTime: p5.Element;
    isPaused: boolean;
    isOver: boolean;
    onGameOver: () => void;

    constructor(onGameOver: () => void) {
        p = Static.getP5();
        this.onGameOver = onGameOver;
        this.fps = Game.MIN_FPS;
        this.score = 0;
        this.playTimeInMs = 0;
        this.grid = new Grid();
        this.spawnSnake();
        this.spawnFood();
        this.pDebug = p.select("#debug");
        this.pScore = p.select("#score");
        this.pTime = p.select("#time");
        this.pSpeed = p.select("#speed");
        this.isPaused = false;
        this.isOver = false;
    }

    spawnSnake() {
        const { x, y } = this.grid.getRandomPosition();
        const initialSize = 3;
        this.snake = new Snake(x, y, initialSize);
        this.snake.onDeath = this.onGameOver;
    }

    spawnFood() {
        let foodX: number;
        let foodY: number;
        let snakeAndFoodCollide: Boolean;
        let loopCount = 1;

        do {
            ({ x: foodX, y: foodY } = this.grid.getRandomPosition());
            snakeAndFoodCollide = this.snake.intersects(foodX, foodY);
            loopCount++;

            if (loopCount > 100) {
                throw new Error("The food is in the way! Too much recursion.");
            }
        } while (snakeAndFoodCollide);

        this.food = new Food(foodX, foodY);
    }

    snakeIsEating() {
        const { x: snakeX, y: snakeY } = this.snake.getHead();
        const { x: foodX, y: foodY } = this.food.position;
        const d = p.dist(snakeX, snakeY, foodX, foodY);
        return d == 0;
    }

    speedUp() {
        this.fps++;
        this.fps = p.constrain(this.fps, Game.MIN_FPS, Game.MAX_FPS);
    }

    update() {
        this.snake.update();

        if (this.snakeIsEating()) {
            console.log("ñam ñam");
            this.score++;
            this.speedUp();
            this.snake.grow();
            this.spawnFood();
        }

        p.frameRate(this.fps);
    }

    show() {
        this._logY = this._logX;
        p.background(220);
        this.grid.show();
        this.snake.show();
        this.food.show();

        this.showTime();
        this.showScore();
        this.showSpeed();
        // this.showDebug();
    }

    showScore() {
        this.pScore.html(`Score: ${this.score}`);
    }

    showSpeed() {
        const speed = (this.fps * 100) / Game.MAX_FPS;
        this.pSpeed.html(`Speed: ${speed.toFixed(0)}%`);
    }

    showDebug() {
        const { x: snakeX, y: snakeY } = this.snake.getHead();
        this.pDebug.html(`Position: ${snakeX},${snakeY}`);
    }

    showTime() {
        this.playTimeInMs += p.deltaTime;
        const time = new Date(0, 0, 0, 0, 0, 0, 0);
        time.setMilliseconds(this.playTimeInMs);
        const pad = (n: number) => n.toString().padStart(2, "0");
        const hours = pad(time.getHours());
        const minutes = pad(time.getMinutes());
        const seconds = pad(time.getSeconds());
        const timeString = `${hours}:${minutes}:${seconds}`;
        this.pTime.html(`Time: ${timeString}`);
    }

    print(msg: string) {
        p.fill("black");
        p.text(msg, this._logX, this._logY);
        this._logY += this._logY;
    }
}

export default Game;
