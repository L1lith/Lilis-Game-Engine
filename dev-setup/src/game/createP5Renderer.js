import { Signal } from "jabr";
import p5 from "p5/global";
import EntityListFormat from "./formats/EntityList";
import { valid } from "sandhands";
import RenderSettingsFormat from "./formats/RenderSettings";

const standardShapes = [
  "square",
  "rect",
  "ellipse",
  "circle",
  "arc",
  "line",
  "triangle",
  "quad",
  "point",
];

export default function createP5Renderer(entities = null, renderSettings) {
  if (entities !== null && !valid(entities, EntityListFormat))
    throw new Error("Please supply a valid EntityList");
  if (!valid(renderSettings, RenderSettingsFormat))
    throw new Error("Please supply valid RenderSettings");
  const p5Instance = new Signal(null);
  const [getInstance, setInstance] = p5Instance;
  const mount = async () => {
    if (!renderSettings.container instanceof HTMLElement)
      throw new Error("Cannot mount, missing container");
    await new Promise((res) => {
      new p5((p) => {
        p.setup = async () => {
          p.noLoop();
          if (typeof renderSettings.setup == "function") {
            try {
              await renderSettings.setup(p);
            } catch (e) {
              console.error(e);
            }
          }
        };

        p.draw = async () => {
          if (entities) {
            for (
              let i = 0, fetchedEntities = entities.get;
              i < fetchedEntities.length;
              i++
            ) {
              const entity = fetchedEntities[i];
              if ("prerender" in entity) {
                // Allow us to add behavior before the automatic shape drawing
                if (!(typeof entity.prerender == "function")) {
                  console.error(new Error("Invalid Pre-Render Function"));
                  continue;
                }
                try {
                  await entity.prerender(p, entity);
                } catch (error) {
                  console.error(error);
                }
              }
              if ("shape" in entity) {
                // Automatically render the entity's shape
                if (!standardShapes.includes(entity.shape)) {
                  console.error(new Error("Invalid Shape Provided"));
                  continue;
                }
                // Render the specified shape
              }
              if ("render" in entity) {
                // Standard rendering behavior happens after the shape drawing
                if (!(typeof entity.render == "function")) {
                  console.error(new Error("Invalid Render Function"));
                  continue;
                }
                try {
                  await entity.render(p, entity);
                } catch (error) {
                  console.error(error);
                }
              }
            }
          }
          if (typeof renderSettings.draw == "function") {
            try {
              await renderSettings.draw(p);
            } catch (e) {
              console.error(e);
            }
          }
        };
        setInstance(p);
        res();
      }, renderSettings.container);
    });
  };
  const unmount = () => {
    getInstance().remove();
    setInstance(null);
  };
  const render = async () => {
    instance.redraw();
  };
  return { mount, unmount, p5Instance, render };
}
