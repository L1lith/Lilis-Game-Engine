import { expect } from "chai";
import { Camera } from "lilis-engine";

describe("Camera", () => {
  it("can be created with no arguments", () => {
    const camera = Camera();
    expect(camera).to.be.an("object");
  });

  it("accepts initial width and height", () => {
    const camera = Camera({ width: 70, height: 90 });
    expect(camera.width).to.equal(70);
    expect(camera.height).to.equal(90);
  });

  it("exposes x and y coordinates", () => {
    const camera = Camera();
    expect(camera).to.have.property("x");
    expect(camera).to.have.property("y");
  });

  it("x and y are writable", () => {
    const camera = Camera();
    camera.x = 12;
    camera.y = -30;
    expect(camera.x).to.equal(12);
    expect(camera.y).to.equal(-30);
  });

  it("width and height are writable", () => {
    const camera = Camera();
    camera.width = 200;
    camera.height = 150;
    expect(camera.width).to.equal(200);
    expect(camera.height).to.equal(150);
  });

  it("accepts a bounds object", () => {
    const camera = Camera();
    camera.bounds = { left: -50, right: 50, top: -50, bottom: 50 };
    expect(camera.bounds).to.deep.equal({
      left: -50,
      right: 50,
      top: -50,
      bottom: 50,
    });
  });

  it("inverseTransformX, if present, is a function", () => {
    const camera = Camera();
    if (camera.inverseTransformX) {
      expect(camera.inverseTransformX).to.be.a("function");
    }
  });

  it("inverseTransformY, if present, is a function", () => {
    const camera = Camera();
    if (camera.inverseTransformY) {
      expect(camera.inverseTransformY).to.be.a("function");
    }
  });

  it("inverseTransformX is the identity when camera is centered at origin", () => {
    const camera = Camera();
    if (!camera.inverseTransformX) return;
    camera.x = 0;
    camera.y = 0;
    expect(camera.inverseTransformX(10)).to.be.closeTo(10, 0.001);
  });

  it("inverseTransformY is the identity when camera is centered at origin", () => {
    const camera = Camera();
    if (!camera.inverseTransformY) return;
    camera.x = 0;
    camera.y = 0;
    expect(camera.inverseTransformY(10)).to.be.closeTo(10, 0.001);
  });

  // Screen position + camera offset = world position. So a camera at
  // x=20 looking at screen-x=30 is actually at world-x=50.
  it("inverseTransformX adds the camera x offset", () => {
    const camera = Camera();
    if (!camera.inverseTransformX) return;
    camera.x = 20;
    camera.y = 0;
    expect(camera.inverseTransformX(30)).to.be.closeTo(50, 0.001);
  });

  it("inverseTransformY adds the camera y offset", () => {
    const camera = Camera();
    if (!camera.inverseTransformY) return;
    camera.x = 0;
    camera.y = -15;
    // Camera at y=-15, screen y of 0 → world y of -15.
    expect(camera.inverseTransformY(0)).to.be.closeTo(-15, 0.001);
  });
});
