import {
  createGameCore,
  Entity,
  EntityList,
  RenderSettings,
  createGameLoop,
} from "lilis-engine";
import createP5Renderer from "lilis-engine/p5";

const canvas = document.getElementById("game");
const renderSettings = RenderSettings({
  canvas,
  calculateDimensions: (width, height) => [
    Math.min(width, height),
    Math.min(width, height),
  ],
});
renderSettings.p = (p) => {
  p.resizeCanvas(p.windowWidth, p.windowHeight);
};

const entities = EntityList([]);

// Background — drawn first because of its very low renderPriority.
entities.addChild(
  Entity({
    shape: "rect",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    fill: "#1a1a2e",
    renderPriority: -100,
  }),
);

// A ball that slides side to side.
const ball = entities.addChild(
  Entity({
    shape: "ellipse",
    x: 0,
    y: 0,
    width: 8,
    height: 8,
    fill: "#85e8ff",
    renderPriority: 0,
  }),
);

// A tiny plugin that animates the ball. This is exactly the shape of
// every plugin in the engine: a `tick` function that reads and writes
// entity state. It doesn't know about p5, or about rendering at all.
let elapsed = 0;
const animateBall = {
  tick: ({ delta }) => {
    elapsed += delta * 0.001;
    ball.x = Math.sin(elapsed) * 30;
  },
};

const gameCore = createGameCore({
  plugins: [
    createGameLoop(),
    createP5Renderer(entities, renderSettings),
    animateBall,
  ],
});

gameCore.mount();
