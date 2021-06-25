import Game from "./game.js";
import Static from "./static.js";
let p;
class Food {
  constructor(x, y) {
    p = Static.getP5();
    this.position = p.createVector(x, y);
  }
  update() {
  }
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
