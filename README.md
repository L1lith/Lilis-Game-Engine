<img src="https://github.com/L1lith/Lilis-Game-Engine/blob/master/site/public/lilis-game-engine-logo.png?raw=true" alt="Graffiti style logo reading &quot;Lili's Game Engine&quot;" height="200"/>

## Technical Explanation

The core idea is simple: entities are observable objects, and systems are plugins. An entity holds its own data, behavior, and events — a position, a sprite, a collision handler, a Solid component — and plugins subscribe to the parts they care about. Physics doesn't know about rendering. Rendering doesn't know about physics. Swapping Pixi for p5, or adding Matter, means changing the plugin list with minimal modifications.

State management is handled using my own [universal state management library Jabr](https://github.com/L1lith/Jabr), which has no ecosystem lock-in — unlike most state libraries, which tend to be tied to a rendering framework like React or SolidJS. That makes it a natural fit for fusing the domains of web development and game development.

The design leans functional rather than object-oriented. Composition is declarative, systems are external functions over shared state, and capabilities are added by declaration rather than inheritance. The entity model itself is closer to a scene graph than to ECS — entities are real objects with identity and lifecycle — but the way logic composes borrows from ECS: systems are external, and every part of the engine was built for separation of concerns and interchangeability.

The same core runs many demos on this site — a platformer with Tiled maps, Matter physics, and a Solid UI, and a two-player Pong game rendered with p5, and many other demos. The renderer, the physics engine, and the game logic are all plugins and entities. None of them import each other.

## Play with the demos!
If you'd like to have some fun and see what the game engine can do try [playing with the demos!](https://engine.webslc.com/demos)

Some of the demos include:
- [Pong using p5.js and MatterJS](https://engine.webslc.com/demos/pong/) [(Source)](https://github.com/L1lith/Lilis-Game-Engine/tree/master/demos/pong)
- [An interactive space themed satellite motion simulator](https://engine.webslc.com/demos/orbital-shapes/) [(Source)](https://github.com/L1lith/Lilis-Game-Engine/tree/master/demos/orbital-shapes)
- [A top-down zelda style game using the Tiled editor](https://engine.webslc.com/demos/topdown/) [(Source)](https://github.com/L1lith/Lilis-Game-Engine/tree/master/demos/topdown)

The main demos can be viewed on [the website's demo page](https://engine.webslc.com/demos) (a fun place to start), and the full list of demos can be viewed [in the project's source code](https://github.com/L1lith/Lilis-Game-Engine/tree/master/demos)

## Getting Started

To begin using the game engine it is recommended you install the command line tool (though not mandatory):

`npm install -g lilis-engine`

Once that's done there are a variety of demo projects for you to toy around with. To view the list of available demos use the "create" command without additional arguments:

`lilis-engine create`

To learn more about any of the available demos use the "info" command with the demo name as the first argument, like this:

`lilis-engine info topdown`

Once you've decided on which demo you'd like to try out you can use the "create" command, with the demo name as the first argument and your project name (no spaces) as the second command:

`lilis-engine create topdown my-zelda-game`

If you'd like to view the full list of demos in your web browser as well as view their source code try visiting the [examples directory in the engine's source code](https://github.com/L1lith/Lilis-Game-Engine/tree/master/examples).

Please note that all of the example projects are made using [SolidJS](https://docs.solidjs.com/) for interactive HTML and [Astro](https://docs.astro.build/en/getting-started/) as the website framework. While these tools are not mandatory for the game engine to run learning the basic of using them will help you greatly both in understanding the example projects' source code and in building web based games & apps going forwards. 

If you'd like to see a minimalist version of using my game engine without using Astro or Solid consider checkout my [vite-minimalist demo](https://engine.webslc.com/demos/vite-minimalist/) ([source code here](https://github.com/L1lith/Lilis-Game-Engine/tree/master/demos/vite-minimalist)) which uses only two small files to define the project's source code.

## Documentation
You can learn how to use this engine by [visiting the documentation!](https://engine.webslc.com/docs/)

## Integrations
This game engine has a number of built in integrations for common game development libraries, for example:
- [matter.js](https://www.brm.io/matter-js/) (physics)
- [P5.js](https://p5js.org/) (rendering)
- [PixiJS](https://pixijs.com/) (rendering)
- [Tiled map editor](https://www.mapeditor.org/) (tile map support)

One of the core features of this game engine is that adding support for new libraries is very easy. If there's a library you'd like to add support for consider making a pull request or opening an issue.

## More Links
- [Website](https://engine.webslc.com/)
- [Source Code](https://github.com/L1lith/Lilis-Game-Engine)