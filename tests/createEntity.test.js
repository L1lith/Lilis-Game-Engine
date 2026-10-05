import { expect } from "chai";
import { createEntity } from "../src/index.js";

describe("Entity Functionality", () => {
  it("can successfully create a blank entity", () => {
    const entity = createEntity();
    expect(entity).to.deep.equal({});
  });
  it("can successfully track property changes", () => {
    const entity = createEntity();
    let callbackValue;
    const targetValue = 12344;
    const testProperty = "damage";
    entity.on(testProperty, (value) => {
      callbackValue = value;
    });
    entity[testProperty] = targetValue;
    expect(callbackValue).to.equal(targetValue);
  });
});
