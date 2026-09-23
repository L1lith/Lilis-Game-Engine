<img src="https://github.com/L1lith/Lilis-Game-Engine/blob/master/site/public/lilis-game-engine-logo.png?raw=true" alt="Graffiti style logo reading &quot;Lili's Game Engine&quot;" height="200"/>

## Technical Explanation

I made this game engine by combining the best in modern web technology. This game engine is highly moddable, meaning it is really easy to combine different libraries together and to add support for new libraries. State management is handled using my own [universal state management library Jabr](https://github.com/L1lith/Jabr) which is very simple to use and has no ecosystem lock-in unlike most state libraries.

This game engine strongly leverages the benefits of being written in a Functional Programming (FP) style instead of Objected Oriented Programming (OOP) while still having some resemblance to OOP by using an [Entity Component System (ECS)](https://www.daydreamsoft.com/blog/ecs-vs-oop-in-large-scale-games-choosing-the-right-architecture-for-performance-and-scalability). In line with Functional Programming ethos every part of my game engine was built to maximize separations of concerns.

If any of these technical details aren't making sense to you don't worry! I suggest you try out setting up an example project and reading the docs :\)

## Play with the demos!
If you'd like to have some fun and see what the game engine can do try [playing with the demos!](https://engine.webslc.com/demos)

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