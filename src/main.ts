import Game from "./game";
import Static from "./static";

let game: Game;
let btnPause: p5.Element;
let _p: p5;

const sketch = (p: p5) => {
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
        btnPause.html("Pause");
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

    btnPause.html("Resume");
    game.isPaused = true;
    _p.noLoop();
}

function handleGameOver() {
    game.isOver = true;
    btnPause.html("Restart");
    _p.noLoop();
    const msg = "GAME OVER";
    console.log(msg);
    alert(msg);
}

new p5(sketch, document.querySelector("#game"));
console.log("main");
