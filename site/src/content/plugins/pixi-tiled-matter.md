---
name: Pixi-Tiled-Matter
category: Others
description: A plugin for adding Matter physics to maps loaded via the Pixi-Tiled plugin
demos: ['topdown', 'sidescroller']
source: https://github.com/L1lith/Lilis-Game-Engine/blob/master/src/plugins/pixi-tiled-to-matter.js
---
This plugin does NOT return a plugin to be added to the plugin list. In [the topdown demo](https://github.com/L1lith/Lilis-Game-Engine/blob/master/demos/topdown/src/levels/levelOne.js) we can see the Pixi-Tiled and Pixi-Tiled-Matter plugins being used in tandem. Pixi-Tiled-Matter is made specifically to add collision to maps loaded via the Pixi-Tiled plugin. It also requires that you have the Matter.js plugin loaded (in our demo this happens in [the Game.jsx file](https://github.com/L1lith/Lilis-Game-Engine/blob/master/demos/topdown/src/components/Game.jsx)).

In [the topdown demo's first level](https://github.com/L1lith/Lilis-Game-Engine/blob/master/demos/topdown/src/levels/levelOne.js) we can see that we import the `PixiTiledToMatter` function from "lilis-engine/pixi-tiled-matter", then we pass it the map we loaded using the Pixi-Tiled plugin. In return it gives us an Entity which contains the collision for the map. We can also use the `createMatterBoundaries` function from the Matter plugin to create the boundaries around the edge of the map. Finally we just add the map, the map collision, and the map boundaries to our entityList. Here's what that full code looks like:

```js
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
    entityList.set([mapEntities, mapCollision, boundaries]);
    return { map };
  },
};
```