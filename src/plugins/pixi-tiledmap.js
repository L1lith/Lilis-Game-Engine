import { convertFunctionToConstructor } from "jabr";
import { extensions, Assets } from "pixi.js";
import { tiledMapLoader } from "pixi-tiledmap";
import createEntity from "../createEntity";
extensions.add(tiledMapLoader);

async function createPixiTiledmap(mapURL, entitySettings = {}) {
  // TODO: Add Support For Automatically Loading Assets using Game Engine Lifecycle
  const output = await Assets.load(mapURL);
  const { container, mapData } = output;
  const widthRatio = Math.max(mapData.width / mapData.height, 1);
  const heightRatio = Math.max(mapData.height / mapData.width, 1);
  const entity = createEntity({
    sprite: container,
    mapData,
    ...entitySettings,
    width: 100 * widthRatio,
    height: 100 * heightRatio,
    widthRatio,
    heightRatio,
  });
  return entity;
}

export default convertFunctionToConstructor(createPixiTiledmap);
