import createPixiTiledmap from "lilis-engine/pixi-tiled";
import { createMatterBoundaries } from "lilis-engine/matter";
import pixiTiledToMatter from "lilis-engine/pixi-tiled-matter";

export default {
  mount: async ({}, { entityList }) => {
    const map = await createPixiTiledmap("hills.tmx");
    const mapCollision = pixiTiledToMatter(map);
    const boundaries = createMatterBoundaries({
      width: map.width,
      height: map.height,
    });
    entityList.set([map, mapCollision, boundaries]);
    return { map };
  },
};
