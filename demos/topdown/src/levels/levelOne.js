import createPixiTiledmap from "lilis-engine/pixi-tiled";
import { createMatterBoundaries } from "lilis-engine/matter";
import pixiTiledToMatter from "lilis-engine/pixi-tiled-matter";
import { Assets, RenderLayer } from "pixi.js";
import { Entity } from "lilis-engine";

export default {
  mount: async ({ entityList }) => {
    //await Assets.load("tileset.png");
    const mapEntities = await createPixiTiledmap("grassy-overworld.tmx");
    const map = mapEntities.get()[0];
    const mapCollision = pixiTiledToMatter(map);
    const boundaries = createMatterBoundaries({
      width: map.width,
      height: map.height,
    });
    entityList.set([mapEntities, mapCollision, boundaries]);
    return { map };
  },
};
