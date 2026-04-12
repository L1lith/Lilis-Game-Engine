import { Engine } from "matter-js";

export default function matterPlugin(entities) {
  let engine;
  const mount = () => {
    engine = Engine.create();
  };
  const tick = ({ delta }) => {
    Engine.update(engine, delta);
  };
  return { tick, mount };
}
