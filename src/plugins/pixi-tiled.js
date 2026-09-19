import { convertFunctionToConstructor } from "jabr";
import { extensions, Assets, RenderLayer } from "pixi.js";
import { tiledMapLoader } from "pixi-tiledmap";
import Entity from "../createEntity.js";
import EntityList from "../createEntityList.js";
extensions.add(tiledMapLoader);

async function createPixiTiledmap(mapURL, entitySettings = {}) {
  // TODO: Add Support For Automatically Loading Assets using Game Engine Lifecycle
  const map = await Assets.load(mapURL);
  const { container, mapData } = map;
  const widthRatio = Math.max(mapData.width / mapData.height, 1);
  const heightRatio = Math.max(mapData.height / mapData.width, 1);
  const mapEntity = Entity({
    sprite: container,
    mapData,
    x: 0,
    ...entitySettings,
    y: 0,
    width: 100 * widthRatio,
    height: 100,
    widthRatio,
    heightRatio,
    mainMap: true,
  });
  const outputs = [mapEntity];
  const customRenderPriorityLayers = mapEntity.sprite.children.filter(
    (layer) =>
      Array.isArray(layer?.layerData.properties) &&
      layer.layerData.properties.find(
        (property) =>
          property?.name === "renderPriority" && isFinite(property?.value),
      ) &&
      !layer.layerData.properties.find(
        // ignore renderPriority if it's a noRender layer
        (property) => property?.name === "noRender" && property?.value === true,
      ),
  );

  customRenderPriorityLayers.forEach((customRenderPriorityLayer) => {
    const outputEntity = Entity({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      sprite: new RenderLayer(),
    });
    outputEntity.sprite.attach(customRenderPriorityLayer);
    outputEntity.renderPriority =
      customRenderPriorityLayer.layerData.properties.find(
        (property) => property?.name === "renderPriority",
      ).value;
    outputs.push(outputEntity);
  });
  const noRenderLayers = mapEntity.sprite.children.filter(
    (layer) =>
      Array.isArray(layer?.layerData.properties) &&
      layer.layerData.properties.find(
        (property) => property?.name === "noRender" && property?.value === true,
      ),
  );
  noRenderLayers.forEach((noRenderLayer) => {
    const outputEntity = Entity({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      sprite: new RenderLayer(),
      noRender: true,
    });
    outputEntity.sprite.attach(noRenderLayer);
    outputs.push(outputEntity);
  });
  return EntityList(outputs);
}

export default convertFunctionToConstructor(createPixiTiledmap);
