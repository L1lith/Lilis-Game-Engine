import * as PIXI from "pixi.js";
import "pixi-tiledmap";

const renderer = PIXI.autoDetectRenderer(442, 286);
document.body.appendChild(renderer.view);

/**
 * Simply load a Tiled map in TMX format like a usual resource
 */
PIXI.loader.add("/test.tmx").load(() => {
  /**
   *   PIXI.extras.TiledMap() is an extended PIXI.Container()
   *   so you can render it right away
   */
  renderer.render(new PIXI.extras.TiledMap("/test.tmx"));
});

export default function createPixiTiledMap() {}
