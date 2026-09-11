import { EntityList, Entity } from "lilis-engine";

export default function Castle(xCenter, yBottom) {
  const castle = EntityList();
  const baseBrickSize = 8;
  const tolerance = 0.5;
  yBottom -= 10; // drop it from the air so it doesn't clip into the floor
  const standardMatterSettings = {
    frictionStatic: 2,
    friction: 2,
    mass: 0.1,
  };
  castle.addChild(
    Block({
      imageURL: "/stone-1x1.png",
      matter: standardMatterSettings,
      x: xCenter - baseBrickSize,
      y: yBottom - baseBrickSize / 2,
      width: baseBrickSize,
      height: baseBrickSize,
    }),
  );

  castle.addChild(
    Block({
      imageURL: "/stone-1x1.png",
      matter: standardMatterSettings,
      x: xCenter + baseBrickSize,
      y: yBottom - baseBrickSize / 2,
      width: baseBrickSize,
      height: baseBrickSize,
    }),
  );

  castle.addChild(
    Block({
      imageURL: "/wood-1x3.png",
      matter: {
        ...standardMatterSettings,
        mass: standardMatterSettings.mass * 0.5,
      },
      x: xCenter,
      y: yBottom - baseBrickSize * 1.5,
      width: baseBrickSize * 5,
      height: baseBrickSize,
    }),
  );

  castle.addChild(
    Block({
      imageURL: "/stone-1x1.png",
      matter: standardMatterSettings,
      x: xCenter - baseBrickSize,
      y: yBottom - baseBrickSize * 2.5,
      width: baseBrickSize,
      height: baseBrickSize,
    }),
  );

  castle.addChild(
    Block({
      imageURL: "/stone-1x1.png",
      matter: standardMatterSettings,
      x: xCenter + baseBrickSize,
      y: yBottom - baseBrickSize * 2.5,
      width: baseBrickSize,
      height: baseBrickSize,
    }),
  );

  return castle;
}

function Block(options) {
  const otherOptions = { ...options };
  delete otherOptions.matter;
  return Entity({
    matter: { shape: "rectangle", friction: 10, ...(options.matter || {}) },
    ...otherOptions,
  });
}

// OLD CASTLE CODE
// ====
// Castle Parsing
// const rawCastleXML = await (await fetch("/castle.svg")).text();
// const castleParser = new DOMParser();
// const castleDoc = castleParser.parseFromString(
//   rawCastleXML,
//   "image/svg+xml",
// );
// const flatChildren = (el) =>
//   [...el.children].map(flatChildren).concat(el).flat();
// const blockElements = flatChildren(castleDoc.children[0]).filter(
//   (block) => block?.tagName?.toLowerCase() === "rect",
// );
// const blockWithSmallestSide = blockElements.sort(
//   (blockA, blockB) =>
//     Math.min(blockA.width.baseVal.value, blockA.height.baseVal.value) -
//     Math.min(blockB.height.baseVal.value, blockB.width.baseVal.value),
// )[0];
// const smallestUnit =
//   Math.min(
//     blockWithSmallestSide.width.baseVal.value,
//     blockWithSmallestSide.height.baseVal.value,
//   ) / 4;
// const blocks = blockElements.map((block) => ({
//   width: Math.round(block.width.baseVal.value / smallestUnit),
//   height: Math.round(block.height.baseVal.value / smallestUnit),
//   x: Math.round(block.x.baseVal.value / smallestUnit),
//   y: Math.round(block.y.baseVal.value / smallestUnit),
// }));
// const bounds = {
//   smallestX: Math.min(...blocks.map((block) => block.x)),
//   smallestY: Math.min(...blocks.map((block) => block.y)),
//   biggestX: Math.max(...blocks.map((block) => block.x)),
//   biggestY: Math.max(...blocks.map((block) => block.y)),
//   biggestWidth: Math.max(...blocks.map((block) => block.width)),
//   biggestHeight: Math.max(...blocks.map((block) => block.height)),
// };
// // blocks.forEach((block) => {
// //   block.x -= bounds.smallestX;
// //   block.y -= bounds.smallestY;
// // });
// window.blocks = blocks
// const gridWidth = bounds.biggestX - bounds.smallestX;
// const gridHeight = bounds.biggestY - bounds.smallestY;
// // end castle parsing
// // Build the castle
// const desiredCastleWidth = 10;
// const desiredCastleHeight = desiredCastleWidth * 1.5;
// const xAdjustmentFactor = desiredCastleWidth / gridWidth
// const yAdjustmentFactor = desiredCastleHeight / gridHeight
// const castleXStart = 30;
// const castleYBottom = 44;
// const blockXUnit = desiredCastleWidth / gridWidth;
// const blockYUnit = desiredCastleHeight / gridHeight;
// console.log({blockXUnit, blockYUnit, gridWidth, gridHeight})

// const castle = entities.addChild(EntityList());
// blocks.forEach((block) => {
//   const blockEntity = Entity({
//     imageURL: "/block.png",
//     matter: {
//       shape: "rectangle",
//     },
//     width: block.width * blockXUnit * xAdjustmentFactor,
//     height: block.height * blockYUnit * yAdjustmentFactor,
//     x: castleXStart + blockXUnit * block.x,
//     y: castleYBottom - blockYUnit * block.y
//   });
//   console.log({...blockEntity})
//   castle.addChild(blockEntity);
// });

// // castle building finished
