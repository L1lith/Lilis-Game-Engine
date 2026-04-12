import { Engine } from "matter-js";

export default function matterPlugin(entities) {
  let engine;
  const mount = () => {
    engine = Engine.create();
  };
  const tick = () => {
    Engine.update(engine, 1000 / 60);
  };
  return { tick };
}
