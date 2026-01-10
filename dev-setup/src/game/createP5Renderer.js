import { Signal } from "jabr";
import p5 from "p5";
import EntityListFormat from "./formats/EntityList";
import { valid } from "sandhands";
import RenderSettingsFormat from "./formats/RenderSettings";
import createPixelProxy from "./createPixelProxy";

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

const smartProperties = [
  "stroke",
  "fill",
  "strokeWeight",
  "erase",
  "noStroke",
  "noFill",
  "noErase",
  "colorMode",
];
const prioritySmartProperties = ["colorMode"];

export default function createP5Renderer(entities = null, renderSettings) {
  if (entities !== null && !valid(entities, EntityListFormat))
    throw new Error("Please supply a valid EntityList");
  if (!valid(renderSettings, RenderSettingsFormat))
    throw new Error("Please supply valid RenderSettings");
  const p5Instance = new Signal(null);
  const [getInstance, setInstance] = p5Instance;
  let drawDoneHandle = null;
  const mount = async () => {
    if (!renderSettings.container instanceof HTMLElement)
      throw new Error("Cannot mount, missing container");
    await new Promise((res) => {
      new p5((p) => {
        if (typeof renderSettings.windowResized == "function")
          p.windowResized = renderSettings.windowResized;
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
          if (typeof renderSettings.preDraw == "function") {
            try {
              await renderSettings.preDraw(p);
            } catch (e) {
              console.error(e);
            }
          }
          if (entities) {
            for (
              let i = 0, fetchedEntities = entities.get();
              i < fetchedEntities.length;
              i++
            ) {
              const entity = fetchedEntities[i];
              smartProperties // Sort so we can call the priority properties first
                .filter((property) =>
                  prioritySmartProperties.includes(property)
                )
                .concat(
                  smartProperties.filter(
                    (property) => !prioritySmartProperties.includes(property)
                  )
                )
                .forEach((smartProperty) => {
                  // Allow us to set things like stroke and fill via assigned entity properties
                  if (entity.hasOwnProperty(smartProperty)) {
                    let value = entity[smartProperty];
                    if (smartProperty === "colorMode") {
                      if (value === "RGB") {
                        value = p.RGB;
                      } else if (value === "HSB") {
                        value = p.HSB;
                      }
                    }
                    if (Array.isArray(value)) {
                      p[smartProperty](...value);
                    } else {
                      p[smartProperty](value);
                    }
                  }
                });
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
                if (!Array.isArray(entity.shapeArgs)) {
                  console.error(
                    new Error("Please supply a valid .shapeArgs array property")
                  );
                  continue;
                }
                // Render the specified shape
                p[entity.shape](...entity.shapeArgs);
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
          if (typeof drawDoneHandle == "function") drawDoneHandle();
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
    const p = getInstance();
    p.loop();
    await new Promise((res) => setTimeout(res, 0));
    p.noLoop();
  };
  const getPixels = () => {
    const p = getInstance();
    p.loadPixels();
    return createPixelProxy(p);
  };
  const savePixels = () => {
    p.updatePixels();
  };
  return {
    mount,
    unmount,
    p5Instance,
    getPixels,
    savePixels,
    render,
    types: ["renderer"],
  };
}
