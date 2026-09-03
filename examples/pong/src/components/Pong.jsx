import { onMount } from "solid-js";
import { isServer } from "solid-js/web";
import {
  createGameCore,
  Entity,
  EntityList,
  RenderSettings,
  createGameLoop,
  createEntityList,
} from "lilis-engine";
import createMatterPlugin from "lilis-engine/matter";
import createP5Renderer from "lilis-engine/p5";

export default function Pong() {
  let canvas;
  onMount(async () => {
    if (isServer) return;
    const entities = (window.entities = createEntityList([]));
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
    // Write the main game code
    entities.addChild(
      Entity({
        // Background
        shape: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fill: "#000000",
      }),
    );
    const leftPaddle = entities.addChild(
      Entity({
        shape: "rect",
        matter: {
          shape: "rectangle",
          isStatic: true,
        },
        x: -40,
        y: 0,
        width: 2,
        height: 10,
        fill: "#85e8ff",
      }),
    );

    const rightPaddle = entities.addChild(
      Entity({
        shape: "rect",
        matter: {
          shape: "rectangle",
          isStatic: true,
        },
        x: 40,
        y: 0,
        width: 2,
        height: 10,
        fill: "#85ffba",
      }),
    );

    const ball = entities.addChild(
      Entity({
        shape: "ellipse",
        matter: {
          shape: "circle",
        },
        x: 0,
        y: 0,
        width: 2.5,
        height: 2.5,
        fill: "white",
      }),
    );
    const topWall = entities.addChild(
      Entity({
        matter: {
          shape: "rectangle",
          isStatic: true,
        },
        x: 0,
        y: -51,
        width: 100,
        height: 2,
      }),
    );

    const bottomWall = entities.addChild(
      Entity({
        matter: {
          shape: "rectangle",
          isStatic: true,
        },
        x: 0,
        y: 51,
        width: 100,
        height: 2,
      }),
    );
    const matterPlugin = createMatterPlugin(entities, {
      setup: (engine) => {
        engine.gravity.x = 0;
        engine.gravity.y = 0;
        leftPaddle.y = 0;
        rightPaddle.y = 0;
      },
    });
    // End of main game setup
    const gameCore = createGameCore({
      plugins: [
        createGameLoop(),
        createP5Renderer(entities, renderSettings),
        matterPlugin,
      ],
    });
    await gameCore.mount();
    console.log("Game Mounted");
  });
  return (
    <canvas
      style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"
      ref={canvas}
    />
  );
}
