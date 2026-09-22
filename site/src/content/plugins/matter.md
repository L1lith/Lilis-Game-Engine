---
name: Matter.js
homePage: https://www.brm.io/matter-js/
description: 2D physics simulator (non-deterministic)
category: Physics Plugins
demos: ['topdown', 'sidescroller', 'pong', 'spike-vs-space']
---
The Matter.js reads and writes to our EntityList automatically. Entity objects are automatically detected as matter.js physics objects when they are supplied a .matter property with your matter config. In that config the primary thing we need to do is define the shape of the collider. Two common shapes are "rectangle" and "circle". For example in the [sidescroller demo](https://github.com/L1lith/Lilis-Game-Engine/blob/master/demos/sidescroller/src/components/Game.jsx) we define the player's hitbox as a circle with the following code:

```js
entities.addChild({renderPriority: 3, x: 10, y:-30, width: 5, height: 5, matter: {shape: 'circle'}, imageURL: 'chicken by Diarandor.png'})
```

The only other things we need to do are 1. Supply the EntityList to the matter plugin during initialization 2. Add the initialized matter plugin the to gameCore's plugin list. The matter plugin automatically handles updating the player's position for us every frame. Whenever we modify the player Entity's position the matter plugin automatically handles updating that in the physics engine for us.
```js
// Again from the sidescroller demo
const matterPhysics = createMatterPlugin(entities)
const gameCore = createGameCore({plugins:[createGameLoop(), pixiRenderer, levelLoader, solidRenderer, matterPhysics, playerControlPlugin, playerOutOfBoundsPlugin]})
```