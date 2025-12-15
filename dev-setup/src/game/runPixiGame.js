import { Store, Signal, isStore } from "jabr";
import createPixiRenderer from "./createPixiRenderer";
import createGameCore from "./createGameCore";
import createGameLoop from "./createGameLoop";
import createEntity from "./createEntity";
import createEntityList from "./createEntityList";
import createRenderSettings from "./createRenderSettings";
import { details } from "sandhands";

export default async function runGame(canvas) {
  const entity = createEntity({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    imageURL: "skull.png",
  });
  const entities = createEntityList([
    createEntity({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      imageURL: "skull.png",
    }),
  ]);
  window.entities = entities;
  const renderSettings = createRenderSettings({
    canvas,
  });
  const gameCore = createGameCore({
    plugins: [createGameLoop(), createPixiRenderer(entities, renderSettings)],
  });
  gameCore.events.on("tick", () => {
    const entity = entities.get()[0];
    if (entity) entity.x = (entity.x + 1) % 100;
  });
  await gameCore.mount();
  return gameCore.unmount;
}
