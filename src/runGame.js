import { Store, Signal } from "jabr";
import createPixiRenderer from "./createPixiRenderer";

export default async function runGame(canvas) {
  const entities = new Signal([
    new Store({ x: 0, y: 0, width: 100, height: 100, image: "skull.png" }),
  ]);
  window.entities = entities;
  const renderSettings = new Store({
    canvas,
  });
  const pixiRenderer = await createPixiRenderer(entities, renderSettings);
  await pixiRenderer.mount();
  await pixiRenderer.render();
  let shouldStop = false;
  const gameLoop = async (timestamp) => {
    if (shouldStop) return;
    window.frameCount = (window.frameCount || 0) + 1;
    const entity = entities.get()[0];
    if (entity) entity.x = (entity.x + 1) % 100;
    await pixiRenderer.render();
    if (!shouldStop) requestAnimationFrame(gameLoop);
  };

  requestAnimationFrame(gameLoop);

  return () => {
    shouldStop = true;
  }; // Stop Function
}
