import { expect } from "chai";
import { createEntity, createEntityList } from "../src/index.js";

describe("Entity Functionality", () => {
  it("can successfully create an empty EntityList", () => {
    const entityList = createEntityList([]);
    expect(entityList.get()).to.deep.equal([]);
  });
  it("can create an entity list with an entity inside it", () => {
    const entity = createEntity();
    const entityList = createEntityList([entity]);
  });
  it("can track changes to the entity list", () => {
    const entityList = createEntityList([]);
    let callbackValue;
    const targetValue = [createEntity()];
    entityList.addListener((value) => {
      callbackValue = value;
    });
    entityList.set(targetValue);
    expect(callbackValue).to.equal(targetValue);
  });
});
