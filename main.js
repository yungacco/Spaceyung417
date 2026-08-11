import { Input } from "./input.js";
import { Game } from "./game.js";
import { initUI } from "./ui.js";

const canvas = document.getElementById("game-canvas");
const input = new Input(canvas);
const game = new Game(canvas, input);
initUI(game, input);
