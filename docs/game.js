import Food from "./food.js";
import Grid from "./grid.js";
import Snake from "./snake.js";
import Static from "./static.js";
let p;
const _Game = class {
  constructor(onGameOver) {
    this._logX = 15;
    p = Static.getP5();
    this.onGameOver = onGameOver;
    this.fps = _Game.MIN_FPS;
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
    const {x, y} = this.grid.getRandomPosition();
    const initialSize = 3;
    this.snake = new Snake(x, y, initialSize);
    this.snake.onDeath = this.onGameOver;
  }
  spawnFood() {
    let foodX;
    let foodY;
    let snakeAndFoodCollide;
    let loopCount = 1;
    do {
      ({x: foodX, y: foodY} = this.grid.getRandomPosition());
      snakeAndFoodCollide = this.snake.intersects(foodX, foodY);
      loopCount++;
      if (loopCount > 100) {
        throw new Error("The food is in the way! Too much recursion.");
      }
    } while (snakeAndFoodCollide);
    this.food = new Food(foodX, foodY);
  }
  snakeIsEating() {
    const {x: snakeX, y: snakeY} = this.snake.getHead();
    const {x: foodX, y: foodY} = this.food.position;
    const d = p.dist(snakeX, snakeY, foodX, foodY);
    return d == 0;
  }
  speedUp() {
    this.fps++;
    this.fps = p.constrain(this.fps, _Game.MIN_FPS, _Game.MAX_FPS);
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
  }
  showScore() {
    this.pScore.html(`Score: ${this.score}`);
  }
  showSpeed() {
    const speed = this.fps * 100 / _Game.MAX_FPS;
    this.pSpeed.html(`Speed: ${speed.toFixed(0)}%`);
  }
  showDebug() {
    const {x: snakeX, y: snakeY} = this.snake.getHead();
    this.pDebug.html(`Position: ${snakeX},${snakeY}`);
  }
  showTime() {
    this.playTimeInMs += p.deltaTime;
    const time = new Date(0, 0, 0, 0, 0, 0, 0);
    time.setMilliseconds(this.playTimeInMs);
    const pad = (n) => n.toString().padStart(2, "0");
    const hours = pad(time.getHours());
    const minutes = pad(time.getMinutes());
    const seconds = pad(time.getSeconds());
    const timeString = `${hours}:${minutes}:${seconds}`;
    this.pTime.html(`Time: ${timeString}`);
  }
  print(msg) {
    p.fill("black");
    p.text(msg, this._logX, this._logY);
    this._logY += this._logY;
  }
};
let Game = _Game;
Game.WIDTH = 500;
Game.HEIGHT = 500;
Game.CELL_SIZE = 25;
Game.MIN_FPS = 4;
Game.MAX_FPS = 60;
export default Game;
