---
name: Pixi.js
homePage: https://pixijs.com/
category: Renderers
description: High performance 2D renderer plugin with GPU acceleration
demos: ['topdown', 'sidescroller', 'spike-vs-space']
---
The most common rendering type with Pixi.js is image textures. We can give an Entity a `.imageURL` property, and then the Pixijs plugin will automatically load that image and render it to the Entity's position on the screen. For example here's how we render the background image to the screen in [our spike-vs-space demo](https://github.com/L1lith/Lilis-Game-Engine/blob/master/demos/spike-vs-space/src/components/SpikeVSSpace.jsx):

```js
Entity({
    imageURL: "sky.png",
    width: 100,
    height: 100,
    renderPriority: -100,
})
```

Entity objects have a default x and y position of 0,0 so we don't need to specify that here. The width and height are both set to 100 so usually that means it will take up the whole screen. Notice we set the `.renderPriority` value to a very low number. This means that it will render beneath everything else, making sure it doesn't block us from seeing any of our game content. However there are other types of Pixi.js assets that need something other than just an imageURL.

## Custom Sprites and Textures
We can provide a Pixi sprite or texture to the pixi plugin for rendering through the `.sprite` and `.texture` properties respectively. For example in [the spike-vs-space demo](https://github.com/L1lith/Lilis-Game-Engine/blob/master/demos/spike-vs-space/src/components/SpikeVSSpace.jsx) we create a tiling ground texture. This require importing the functions we need from Pixi.js directly and then in our case we supply the tiling texture via the `.sprite` prop:

```js
// At the top of the file
import { Assets, TilingSprite } from "pixi.js";

// Inside our main game engine code
const grassTexture = await Assets.load("grass.png"); // Load the regular image first
const ground = entities.addChild(
    Entity({
    sprite: new TilingSprite({ // Turn it into a repeating texture
        texture: grassTexture,
    }),
    matter: {
        static: true,
        shape: "rectangle",
    },
    width: 1000,
    height: 9.5,
    x: 0,
    y: 47.5,
    tileScaleX: 10,
    tileScaleY: 10,
    }),
);
```