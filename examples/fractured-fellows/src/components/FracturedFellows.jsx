import { onMount } from "solid-js";
import { isServer } from "solid-js/web";
import {
  createGameCore,
  Entity,
  EntityList,
  RenderSettings,
  createGameLoop,
  createEntityList,
} from "lilis-engine";
import { detectKeys } from "lilis-engine/utility";
import createMatterPlugin from "lilis-engine/matter";
import createPixiRenderer from "lilis-engine/pixi";
import { Signal } from "jabr";
import Matter from "matter-js";
import {Assets, TilingSprite} from 'pixi.js'
//Matter.Resolver._restingThresh = 0.001;
const { Body } = Matter; // https://www.youtube.com/watch?v=Ilq5XHRpUSE

export default function FracturedFellows() {
  let canvas;
  onMount(async () => {
    if (isServer) return;
    const entities = (window.entities = createEntityList([]));
    const renderSettings = RenderSettings({canvas});
    const autoResize = ()=>{
      const size = Math.min(window.innerWidth, window.innerHeight)
      renderSettings.width = renderSettings.height = size
    }
    window.addEventListener('resize', autoResize)
    autoResize()
    const grassTexture = await Assets.load('/grass.png')
    const ground = entities.addChild(Entity({
      sprite: new TilingSprite({
        texture: grassTexture,
      }),
      width: 100,
      height: 5,
      x: 0,
      y: 47.5
    }))
    const matterPlugin = createMatterPlugin(entities)
    // End of main game setup
    const gameCore = createGameCore({
      plugins: [
        createGameLoop(),
        createPixiRenderer(entities, renderSettings),
        matterPlugin,
      ],
    });
    await gameCore.mount();
    console.log("Game Mounted");
  });
  return (
    <canvas
      style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"
      ref={canvas}
    />
  );
}
