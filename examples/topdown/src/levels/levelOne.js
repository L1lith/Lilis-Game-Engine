import createPixiTiledmap from "lilis-engine/pixi-tiled";
import { createMatterBoundaries } from "lilis-engine/matter";
import pixiTiledToMatter from "lilis-engine/pixi-tiled-matter";
import { Assets, RenderLayer } from "pixi.js";
import { Entity } from "lilis-engine";

export default {
  mount: async ({}, { entityList }) => {
    //await Assets.load("tileset.png");
    const mapEntities = await createPixiTiledmap("grassy-overworld.tmx");
    const map = mapEntities.get()[0];
    const mapCollision = pixiTiledToMatter(map);
    const boundaries = createMatterBoundaries({
      width: map.width,
      height: map.height,
    });
    // const overhead = new Entity({
    //   x: 0,
    //   y: 0,
    //   width: 100,
    //   height: 100,
    //   sprite: new RenderLayer(),
    // });
    // const overheadLayers = map.sprite.children.filter(
    //   (layer) =>
    //     Array.isArray(layer?.layerData.properties) &&
    //     layer.layerData.properties.find(
    //       (property) =>
    //         property?.name === "overhead" && property?.value === true,
    //     ),
    // );
    // overheadLayers.forEach((overheadLayer) =>
    //   overhead.sprite.attach(overheadLayer),
    // );

    // overhead.renderPriority = 100;
    entityList.set([mapEntities, mapCollision, boundaries]);
    return { map };
  },
};
