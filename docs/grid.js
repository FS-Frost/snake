import Game from "./game.js";
import Static from "./static.js";
let p;
class Grid {
  constructor() {
    p = Static.getP5();
    this.rows = Game.HEIGHT / Game.CELL_SIZE;
    this.columns = Game.WIDTH / Game.CELL_SIZE;
    p.print(`Grid: ${this.rows}x${this.columns}`);
  }
  getRandomPosition() {
    const row = p.floor(p.random(1, this.rows));
    const column = p.floor(p.random(1, this.columns));
    const x = row * Game.CELL_SIZE;
    const y = column * Game.CELL_SIZE;
    return p.createVector(x, y);
  }
  show() {
    p.fill("white");
    p.rect(0, 0, Game.WIDTH, Game.HEIGHT);
    for (let i = 1; i < this.columns; i++) {
      const lineX = Game.CELL_SIZE * i;
      const lineY1 = 0;
      const lineY2 = Game.HEIGHT;
      p.line(lineX, lineY1, lineX, lineY2);
    }
    for (let i = 1; i < this.rows; i++) {
      const lineY = Game.CELL_SIZE * i;
      const lineX1 = 0;
      const lineX2 = Game.WIDTH;
      p.line(lineX1, lineY, lineX2, lineY);
    }
  }
}
export default Grid;
