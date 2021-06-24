import Game from "./game";
import Static from "./static";

let game: Game;

const sketch = (p: p5) => {
    p.setup = () => {
        Static.setP5(p);
        p.createCanvas(Game.WIDTH, Game.HEIGHT);
        p.background(220);
        game = new Game();
    };

    p.draw = () => {
        game.update();
        game.show();
    };
};

new p5(sketch);
console.log("main");
