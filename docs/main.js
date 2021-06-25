import Game from "./game.js";
import Static from "./static.js";
let game;
let btnPause;
let _p;
const sketch = (p) => {
  p.setup = () => {
    _p = p;
    Static.setP5(p);
    p.createCanvas(Game.WIDTH, Game.HEIGHT);
    p.background(220);
    game = new Game(handleGameOver);
    btnPause = p.select("#pause");
    btnPause.mouseClicked(togglePause);
  };
  p.draw = () => {
    game.update();
    game.show();
  };
};
function togglePause() {
  if (game.isPaused) {
    btnPause.html("Resume");
    game.isPaused = false;
    _p.loop();
    return;
  }
  if (game.isOver) {
    game = new Game(handleGameOver);
    btnPause.html("Pause");
    _p.loop();
    return;
  }
  btnPause.html("Pause");
  game.isPaused = true;
  _p.noLoop();
}
function handleGameOver() {
  game.isOver = true;
  btnPause.html("Restart");
  _p.noLoop();
  console.log("GAME OVER");
}
new p5(sketch, document.querySelector("#game"));
console.log("main");
