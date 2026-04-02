import { Store, Signal, isStore } from "jabr";
import createP5Renderer from "./createP5Renderer";
import createGameCore from "./createGameCore";
import createGameLoop from "./createGameLoop";
import createEntity from "./createEntity";
import createEntityList from "./createEntityList";
import createRenderSettings from "./createRenderSettings";
import { details } from "sandhands";

export default async function runGame(container) {
  const entity = createEntity();
  const entities = createEntityList([entity]);
  window.entities = entities;
  const renderSettings = createRenderSettings({
    container,
    setup: (p) => {
      console.log(p);
      p.createCanvas(1000, 1000);
      p.background(200);
    },
  });
  const gameCore = createGameCore({
    plugins: [createGameLoop(), createP5Renderer(entities, renderSettings)],
  });
  gameCore.events.on("tick", () => {
    entity.x = (entity.x + 1) % 100;
  });
  await gameCore.mount();
  return gameCore.unmount;
}
