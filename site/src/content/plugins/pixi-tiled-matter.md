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

That's it for the coding aspect, but there's still a little more to do. In the Tiled editor we can assign properties to the layers to define whether they have collision or not. In order for a layer to have collision we must set the "collision" property of the layer to a boolean value of true (the box must be checked). When a tile layer has collision enabled it will make a square hitbox wherever there is a hitbox. The hitbox shape does not change even if there are transparent pixels. If you'd like to make non-square hitboxes then you will need to define a shape layer in Tiled.

## Shape Layers
We can define custom hitbox shapes inside the Tiled editor using the shape layer. These are vector style tools for making circles, squares, or other arbitrary polygons. In order to give them hitboxes we still need to set the "collision" property of the layer to true (checked). One issue is that by default these shapes will be rendered to the screen which is usually unwanted. This can be solved by setting the layer property "noRender" to true (aka the box is checked).