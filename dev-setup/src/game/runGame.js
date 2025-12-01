import { Store, Signal } from "jabr";
import createPixiRenderer from "./createPixiRenderer";

export default function runGame(canvas) {
  const entities = new Signal([
    new Store({ x: 0, y: 0, width: 100, height: 100, image: "skull.png" }),
  ]);
  const PixiRenderer = createPixiRenderer(canvas, entities);
  let shouldStop = false;
  const gameLoop = (timestamp) => {
    if (shouldStop) return;
    const entity = entities.get()[0];
    if (entity) entity.x = (entity.x + 1) % 100;
    if (Math.random() < 0.001) entities.set([]);
    //entities[0].x = entities[0].x + 1;
    if (!shouldStop) requestAnimationFrame(gameLoop);
  };

  requestAnimationFrame(gameLoop);

  return () => {
    shouldStop = true;
  }; // Stop Function
}
