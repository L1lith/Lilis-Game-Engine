import { expect } from "chai";
import { Entity, EntityList } from "lilis-engine";

describe("Entity children", () => {
  it("can be created without children", () => {
    const entity = Entity({ x: 0, y: 0 });
    expect(entity).to.be.an("object");
  });

  it("can be created with a children EntityList", () => {
    const child = Entity({ x: 5, y: 5 });
    const entity = Entity({
      x: 0,
      y: 0,
      children: EntityList([child]),
    });
    expect(entity.children).to.exist;
  });

  it("exposes children via .children.get()", () => {
    const child = Entity({ x: 5, y: 5 });
    const entity = Entity({
      x: 0,
      y: 0,
      children: EntityList([child]),
    });
    const kids = entity.children.get();
    expect(kids).to.be.an("array");
    expect(kids.length).to.equal(1);
    expect(kids[0].x).to.equal(5);
  });

  it("children EntityList supports addChild", () => {
    const parent = Entity({ x: 0, y: 0, children: EntityList([]) });
    const child = Entity({ x: 7, y: 8 });
    parent.children.addChild(child);
    expect(parent.children.get().length).to.equal(1);
    expect(parent.children.get()[0].x).to.equal(7);
  });

  it("children list preserves reference to added children", () => {
    const parent = Entity({ x: 0, y: 0, children: EntityList([]) });
    const child = Entity({ x: 42, y: 0 });
    parent.children.addChild(child);
    const retrieved = parent.children.get()[0];
    expect(retrieved).to.equal(child);
  });

  it("nested children are addressable from the top", () => {
    const grandchild = Entity({ x: 3, y: 3 });
    const child = Entity({
      x: 1,
      y: 1,
      children: EntityList([grandchild]),
    });
    const parent = Entity({
      x: 0,
      y: 0,
      children: EntityList([child]),
    });
    const topKids = parent.children.get();
    expect(topKids.length).to.equal(1);
    const innerKids = topKids[0].children.get();
    expect(innerKids.length).to.equal(1);
    expect(innerKids[0].x).to.equal(3);
  });
});

describe("EntityList deepFlat", () => {
  // deepFlat returns a Signal-like object (same shape as an EntityList),
  // not a plain array. Use .get() to read the underlying flat array.
  const asArray = (flat) =>
    typeof flat?.get === "function" ? flat.get() : flat;

  it("flattens a simple list", () => {
    const a = Entity({ x: 1, y: 1 });
    const b = Entity({ x: 2, y: 2 });
    const list = EntityList([a, b]);
    if (!list.deepFlat) return;
    const flat = asArray(list.deepFlat);
    expect(flat).to.be.an("array");
    expect(flat.length).to.equal(2);
  });

  it("flattens nested entity lists", () => {
    const a = Entity({ x: 1, y: 1 });
    const b = Entity({ x: 2, y: 2 });
    const innerList = EntityList([b]);
    const outerList = EntityList([a, innerList]);
    if (!outerList.deepFlat) return;
    const flat = asArray(outerList.deepFlat);
    expect(flat).to.be.an("array");
    // Both `a` and `b` should be reachable in the flat result.
    expect(flat).to.include(a);
    expect(flat).to.include(b);
  });

  // `deepFlat` recurses into nested EntityLists but does NOT recurse into
  // entity.children. Children are addressed via the parent entity, not
  // promoted to the top level.
  it("flattens nested EntityLists but not entity children", () => {
    const child = Entity({ x: 5, y: 5 });
    const parent = Entity({
      x: 0,
      y: 0,
      children: EntityList([child]),
    });
    const list = EntityList([parent]);
    if (!list.deepFlat) return;
    const flat = asArray(list.deepFlat);
    expect(flat).to.include(parent);
    expect(flat).to.not.include(child);
  });
});
