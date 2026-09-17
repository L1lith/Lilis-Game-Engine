<img src="https://github.com/L1lith/Lilis-Game-Engine/blob/master/site/public/lilis-game-engine-logo.png?raw=true" alt="Graffiti style logo reading &quot;Lili's Game Engine&quot;" height="200"/>

I made this game engine by combining the best in modern web technology. This game engine is highly moddable, meaning it is really easy to combine different libraries together and to add support for new libraries. State management is handled using my own [universal state management library Jabr](https://github.com/L1lith/Jabr) which is very simple to use and has no ecosystem lock-in unlike most state libraries.

This game engine strongly leverages the benefits of being written in a Functional Programming (FP) style instead of Objected Oriented Programming (OOP) while still having some resemblance to OOP by using an [Entity Component System (ECS)](https://www.daydreamsoft.com/blog/ecs-vs-oop-in-large-scale-games-choosing-the-right-architecture-for-performance-and-scalability). In line with Functional Programming ethos every part of my game engine was built to maximize separations of concerns.

If any of these technical details aren't making sense to you don't worry! I suggest you try out setting up an example project and reading the docs :\)

## Getting Started

To get started find a [demo](https://l1lith.github.io/Lilis-Game-Engine/demos/) that you would like to use, then click "View Source Code" to see the corresponding directory name. Then use the following command in the command line (with the command line located in the directory you would like to create your project in), replacing "example-name" with the name of the example directory you'd like to use as your basis:
```bash
npx lilis-engine create example-name destination-dir
```
So for example if we want to make a flappy bird type game in the "my-first-flappy-game" directory we'd use:
```bash
npx lilis-engine create spike-vs-space my-first-flappy-game
```

There are also more example projects available that are not listed in the demo page, you can find them by visiting the [examples directory](https://github.com/L1lith/Lilis-Game-Engine/tree/master/examples) in the engine's source code or you can list their names by using the create command without additional arguments:

```bash
npx liis-engine create
```

Please note that all of the example projects are made using [SolidJS](https://docs.solidjs.com/) for interactive HTML and [Astro](https://docs.astro.build/en/getting-started/) as the website framework. While these tools are not mandatory for the game engine to run learning the basic of using them will help you greatly both in understanding the example projects' source code and in building web based games & apps going forwards.

## Documentation
You can learn how to use this engine by [visiting the documentation!](https://l1lith.github.io/Lilis-Game-Engine/docs/)

## Integrations
This game engine has a number of built in integrations for common game development libraries, for example:
- [matter.js](https://www.brm.io/matter-js/) (physics)
- [P5.js](https://p5js.org/) (rendering)
- [PixiJS](https://pixijs.com/) (rendering)
- [Tiled map editor](https://www.mapeditor.org/) (tile map support)

One of the core features of this game engine is that adding support for new libraries is very easy. If there's a library you'd like to add support for consider making a pull request or opening an issue.

## More Links
- [Website](https://l1lith.github.io/Lilis-Game-Engine/)
- [Source Code](https://github.com/L1lith/Lilis-Game-Engine)