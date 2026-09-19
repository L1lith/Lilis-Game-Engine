import createPixiTiledmap from "lilis-engine/pixi-tiled";
import { createMatterBoundaries } from "lilis-engine/matter";
import pixiTiledToMatter from "lilis-engine/pixi-tiled-matter";
import { Assets } from "pixi.js";

export default {
  mount: async ({}, { entityList }) => {
    //await Assets.load("tileset.png");
    const map = await createPixiTiledmap("grassy-overworld.tmx");
    const mapCollision = pixiTiledToMatter(map);
    const boundaries = createMatterBoundaries({
      width: map.width,
      height: map.height,
    });
    entityList.set([map, mapCollision, boundaries]);
    return { map };
  },
};
