import Game from "./game.js";
import Static from "./static.js";
let p;
class Food {
  constructor(x, y) {
    p = Static.getP5();
    this.position = p.createVector(x, y);
    this.size = Game.CELL_SIZE;
  }
  update() {
  }
  show() {
    p.fill("red");
    p.rect(this.position.x, this.position.y, this.size, this.size);
  }
}
export default Food;
