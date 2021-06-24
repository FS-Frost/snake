import Food from "./food.js";
import Grid from "./grid.js";
import Snake from "./snake.js";
import Static from "./static.js";
let p;
class Game {
  constructor() {
    this._logX = 15;
    p = Static.getP5();
    this.score = 0;
    this.playTimeInMs = 0;
    this.grid = new Grid();
    this.spawnSnake();
    this.spawnFood();
    this.pDebug = p.select("#debug");
    this.pScore = p.select("#score");
    this.pTime = p.select("#time");
    this.isPaused = false;
  }
  spawnSnake() {
    const {x, y} = this.grid.getRandomPosition();
    const initialSize = 3;
    this.snake = new Snake(x, y, initialSize);
  }
  spawnFood() {
    const {x: snakeX, y: snakeY} = this.snake.getHead();
    let foodX;
    let foodY;
    let snakeAndFoodCollide;
    let loopCount = 1;
    do {
      ({x: foodX, y: foodY} = this.grid.getRandomPosition());
      snakeAndFoodCollide = foodX == snakeX && foodY == snakeY;
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
  update() {
    this.snake.update();
    if (this.snakeIsEating()) {
      this.score++;
      this.snake.grow();
      this.spawnFood();
    }
  }
  show() {
    this._logY = this._logX;
    p.background(220);
    this.grid.show();
    this.snake.show();
    this.food.show();
    this.showTime();
    this.showScore();
  }
  showScore() {
    this.pScore.html(`Score: ${this.score}`);
  }
  showDebug() {
    const {x: snakeX, y: snakeY} = this.snake.getHead();
    this.pDebug.html(`Position: ${snakeX},${snakeY}`);
  }
  showTime() {
    this.playTimeInMs += p.deltaTime;
    const time = new Date(0, 0, 0, 0, 0, 0, 0);
    time.setMilliseconds(this.playTimeInMs);
    const pad = (n) => {
      return String(n).padStart(2, "0");
    };
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
}
Game.WIDTH = 500;
Game.HEIGHT = 500;
Game.CELL_SIZE = 25;
export default Game;
