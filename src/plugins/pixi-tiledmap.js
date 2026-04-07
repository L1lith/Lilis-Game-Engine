import { convertFunctionToConstructor } from "jabr";
import { extensions, Assets } from "pixi.js";
import { tiledMapLoader } from "pixi-tiledmap";
import createEntity from "../createEntity";
extensions.add(tiledMapLoader);

async function createPixiTiledmap(mapURL, entitySettings = {}) {
  // TODO: Add Support For Automatically Loading Assets using Game Engine Lifecycle
  const { container } = await Assets.load(mapURL);
  return createEntity({ sprite: container, ...entitySettings });
}

export default convertFunctionToConstructor(createPixiTiledmap);
