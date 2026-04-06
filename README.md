# Lili's Game Engine
This game engine is very modular, simple, and highly adaptable. It's adaptability comes from the intentional support for developing plugins which can suit any use case. This game engine is also designed from the ground up to work entirely using **functional programming** instead of object oriented programming, which I believe is a much better design pattern.
 
## Now on NPM!
This engine can now be installed via NPM:
```bash
npm install lilis-engine
```
 
## About this engine
 
This game engine takes inspiration from web frameworks like [Astro.build](https://astro.build/) which emphasize clean code and interoperability as a fundamental design principle, rather than an afterthought. Many coding projects incur massive technical debt under a "ship now, fix later" mindset, which inevitably leads to large amounts wasted time which could have been prevented with more forethought. I spent multiple years designing this game engine, even rebuilding it from scratch so that it will stand the tests of time and save developers time and headaches. I did this by inventing cleaner and more effective design patterns that serve as the foundation of your game, primarily two things serve as the bedrock of the game engine:
 
1. Functional Programming
2. Signals
 
Signals are a concept borrowed a web UI library called SolidJS, but I built my own implementation of them called [Jabr](https://www.npmjs.com/package/jabr) which has been disentangled from the specifics of web UI libraries. Basically we can take one of the most powerful tools from cutting edge web development and apply it to game development. In practical terms it's like a variable that we can automatically listen for changes in it's value. They are extremely flexible, and I believe they can be used to sidestep the messiness that arises when using classes in Object Oriented Programming! Instead of classes we can use callbacks, and JavaScript's async feature makes coordinating events and tasks across time simple.
 
## More On Signals
 
Here is some example of how Jabr can be used in game development:
 
```js
import {Signal} from 'jabr'
const [getPlayerPos, setPlayerPos, addPlayerPosListener, removePlayerPosListener] = new Signal({x: 0, y: 10})
 
const playerPositionListener = (newValue, oldValue) => {
console.log('New Player Position: ' + newValue)
console.log('Old Player Position: ' + oldValue)
}
 
addPlayerPosListener(playerPositionListener)
 
setPlayerPos({x: 8, y: -99}) // Now our listener is called, logging our old and new player positions
 
removePlayerPosListener(playerPositionListener)
 
setPlayerPos({x: 99, y: -190}) // Nothing is logged because we removed our listener
```
 
By passing this player signal to our physics engine we no longer need to manually tell the physics engine when our player position changes, or create custom listeners to handle the physics engine updating the player position. There is now a single source of truth for this player position variable that allows us to gracefully handle updates without needing to rely on a tangled web of classes. My game engine expands on this concept, giving you an effective base for your game engine that is written in as few lines of code as possible so you can study it inside and out and customize it to your heart's content.
 
## Diving into an example usage of the game engine
 
Enough technical breakdown of why I love this game engine, let's dive into an example of how it looks in practice. Below is some example code, notice how each component of the game engine is manually initialized. While that does increase the number of lines of code by a small amount, it leaves room for you to swap these plugins out with your own choice of plugins. Yes, even the default core behaviors of the game engine are themselves plugins with easily inspectable source code. Without further adieu:
 
```js
import {createGameCore, createGameLoop, createEntity, createEntityList, createRenderSettings } from 'lilis-engine'
import createP5Renderer from 'lilis-engine/p5'
 
export default async function runGame(container) {
  const entity = createEntity();
  const entities = createEntityList([entity]);
  window.entities = entities;
  const renderSettings = createRenderSettings({
    container,
    setup: (p) => {
      console.log(p);
      p.createCanvas(1000, 1000);
      p.background(200);
    },
  });
  const gameCore = createGameCore({
    plugins: [createGameLoop(), createP5Renderer(entities, renderSettings)],
  });
  gameCore.events.on("tick", () => {
    entity.x = (entity.x + 1) % 100;
  });
  await gameCore.mount();
  return gameCore.unmount;
}
```
 
Here we setup our plugins, tell the p5.js renderer how to initialize the canvas, and create an on-screen entity that automatically moves left-to-right across the screen in about 30 lines of code. While a full functional game would take more than this, this example highlights all of the most basic functionality that you need to make a game with the engine! While that is a neat feat, I am confident that this simplicity scales to even flushed out games because I battle tested it in my first published game [Drawlf](https://l1lith.github.io/Drawlf-Host/)!
 
## Plugins
|Plugin Name | Plugin Type | Description |
|--|--|--|
| p5 | Renderer | Adds support for the [p5.js rendering library](https://beta.p5js.org/) |
| pixi | Renderer | Adds support for the [pixi.js rendering library](https://pixijs.com/) |

Plugins are optional imports that add support for external libraries. This game engine is designed to be as modular as possible, making using external libraries as easy as possible. In the future I would love to have plugins for as many libraries as possible, if you'd like to add a plugin to this project please make a pull request. Plugins must be imported separately from the core engine, for example if you'd like pixijs you'd use this (using the plugin name from the above table):

```js
import createPixiRenderer from 'lilis-engine/pixi'
```

You can also make your own plugins for your own libraries, it is relatively easy! You can view the [plugins source code here](https://github.com/L1lith/Lilis-Game-Engine/tree/master/src/plugins) for more information on how they work or for inspiration on making your own plugins. The goal is for all plugins to function as similarly as possible so that developers need to make as few changes to their games source code when changing plugins! This can make doing things like swapping rendering libraries a breeze.