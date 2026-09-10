import { onMount } from "solid-js";
import { isServer } from "solid-js/web";
import {
  createGameCore,
  Entity,
  EntityList,
  RenderSettings,
  createGameLoop,
  createEntityList,
  Camera
} from "lilis-engine";
import { detectKeys, screenToWorldPosition } from "lilis-engine/utility";
import createMatterPlugin from "lilis-engine/matter";
import createPixiRenderer from "lilis-engine/pixi";
import { Signal } from "jabr";
import Matter from "matter-js";
import {Assets, TilingSprite} from 'pixi.js'
//Matter.Resolver._restingThresh = 0.001;
const { Body } = Matter; // https://www.youtube.com/watch?v=Ilq5XHRpUSE

function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}
function calculateAngle(x1, y1, x2, y2) {
    const radians = Math.atan2(y2 - y1, x2 - x1);
    return radians
    // const degrees = radians * 180 / Math.PI;
    // return degrees;
}
function calculateCenter(x1, y1, x2, y2) {
  const width = Math.max(x1, x2) - Math.min(x1, x2)
  const height = Math.max(y1, y2) - Math.min(y1, y2)
  return {
    x: Math.min(x1, x2) + width / 2,
    y: Math.min(y1, y2) + height / 2
  }
}
function getPointAtDistance(start, end, distance, clamp = false) {
    console.log(JSON.stringify({start, end, distance, clamp}))
    // Calculate the vector from start to end
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // Calculate the total distance between start and end
    const totalDistance = Math.sqrt(dx * dx + dy * dy);
    
    // If the distance is 0, return the start point (avoid division by zero)
    if (totalDistance === 0) {
        return { x: start.x, y: start.y };
    }
    
    // Calculate the ratio of the desired distance to the total distance
    let ratio = distance / totalDistance;
    
    // Clamp the ratio if clamp is true
    if (clamp) {
        ratio = Math.min(ratio, 1);
    }
    
    // Calculate the point at the given distance along the line
    return {
        x: start.x + dx * ratio,
        y: start.y + dy * ratio
    };
}
function clampAngleToRange(start, end, centerAngleDeg, angleRangeDeg) {
    // Calculate the vector from start to end
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // Calculate the actual angle from start to end (in degrees)
    const actualAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    
    // Calculate the distance from start to end
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate the angle difference from center
    let angleDiff = actualAngleDeg - centerAngleDeg;
    
    // Normalize angle difference to [-180, 180]
    angleDiff = ((angleDiff % 360) + 540) % 360 - 180;
    
    // Calculate the half-range
    const halfRange = angleRangeDeg / 2;
    
    // Clamp the angle to the allowed range
    let clampedAngle;
    if (angleDiff > halfRange) {
        clampedAngle = centerAngleDeg + halfRange;
    } else if (angleDiff < -halfRange) {
        clampedAngle = centerAngleDeg - halfRange;
    } else {
        clampedAngle = actualAngleDeg;
    }
    
    // Convert clamped angle to radians
    const clampedAngleRad = clampedAngle * (Math.PI / 180);
    
    // Return the new point at the same distance but clamped angle
    return {
        x: start.x + distance * Math.cos(clampedAngleRad),
        y: start.y + distance * Math.sin(clampedAngleRad)
    };
}

export default function FracturedFellows() {
  let canvas;
  onMount(async () => {
    if (isServer) return;
    document.onkeydown = function(event) { // Disable Browser Zoom
    if (event.ctrlKey && (event.key === '+' || event.key === '-')) {
    event.preventDefault();
    }
    };
    const entities = (window.entities = createEntityList([]));
    const renderSettings = RenderSettings({canvas});
    const autoResize = ()=>{
      const size = Math.min(window.innerWidth, window.innerHeight)
      renderSettings.width = renderSettings.height = size
    }
    window.addEventListener('resize', autoResize)
    autoResize()
    const grassTexture = await Assets.load('/grass.png')
    const ground = entities.addChild(Entity({
      sprite: new TilingSprite({
        texture: grassTexture,
      }),
      matter: {
        static: true,
        shape: 'rectangle'
      },
      width: 110,
      height: 9.5,
      x: 0,
      y: 47.5,
      tileScaleX: 10,
      tileScaleY: 10
    }))
    const slingshot = entities.addChild(Entity({
      imageURL: '/slingshot.png',
      height: 15,
      width: 8,
      x: -30,
      y: 36,
      renderPriority: 1
    }))
    const slingshotLeft = entities.addChild(Entity({
      imageURL: '/slingshot-left.png',
      height: slingshot.height,
      width: slingshot.width,
      x: slingshot.x,
      y: slingshot.y,
      renderPriority: (slingshot.renderPriority || 0) + 10
    }))
    const rubberBandA = entities.addChild(Entity({
      imageURL: '/rubber-band.png',
      height: 1,
      renderPriority: 2
    }))
    const rubberBandB = entities.addChild(Entity({
      imageURL: '/rubber-band.png',
      height: rubberBandA.height
    }))
    const rubberBandAttachmentA = {x: slingshot.x - 3, y: slingshot.y - 3}
    const rubberBandAttachmentB = {x: slingshot.x + 1.75, y: slingshot.y - 6}
    const rubberBandRestingPoint = {x: slingshot.x, y: slingshot.y - 5}
    const maxRubberBandLength = 15
    const rubberBandAngleCenter = 150
    const rubberBandDegreesOfFreedom = 80
    const dragRubberBandsTo = (targetX, targetY) => {
        // const width = Math.max(x, rubberBandRestingPoint.x) - Math.min(x, rubberBandRestingPoint.x)
        // const height = Math.max(y, rubberBandRestingPoint.y) - Math.min(y, rubberBandRestingPoint.y)
        // const restingPointAngle = calculateAngle(x, y, rubberBandRestingPoint.x, rubberBandRestingPoint.y)
        const {x, y} = clampAngleToRange(rubberBandRestingPoint, getPointAtDistance(rubberBandRestingPoint, {x: targetX, y: targetY}, maxRubberBandLength, true), rubberBandAngleCenter, rubberBandDegreesOfFreedom)
        console.log({targetX, x, targetY, y})
        const rubberBandADistance = calculateDistance(x, y, rubberBandAttachmentA.x, rubberBandAttachmentA.y)
        const rubberBandBDistance = calculateDistance(x, y, rubberBandAttachmentB.x, rubberBandAttachmentB.y)
        rubberBandA.width = rubberBandADistance
        rubberBandB.width = rubberBandBDistance
        const {x: bandAx, y: bandAy} = calculateCenter(rubberBandAttachmentA.x, rubberBandAttachmentA.y, x, y)
        const {x: bandBx, y: bandBy} = calculateCenter(rubberBandAttachmentB.x, rubberBandAttachmentB.y, x, y)
        rubberBandA.x = bandAx
        rubberBandA.y = bandAy
        rubberBandB.x = bandBx
        rubberBandB.y = bandBy
        const rubberBandARotation = calculateAngle(x, y, rubberBandAttachmentA.x, rubberBandAttachmentA.y)
        const rubberBandBRotation = calculateAngle(x, y, rubberBandAttachmentB.x, rubberBandAttachmentB.y)
        rubberBandA.rotation = rubberBandARotation
        rubberBandB.rotation = rubberBandBRotation
    }
    const sceneCamera = renderSettings.camera = Camera()//Camera({x: -25, y: 25, width: 50, height: 50})
    dragRubberBandsTo(rubberBandRestingPoint.x, rubberBandRestingPoint.y)
    window.addEventListener('mousemove', ({layerX, layerY, target}) => {
      if (target !== canvas) return dragRubberBandsTo(rubberBandRestingPoint.x, rubberBandRestingPoint.y)
      const xPercent = layerX / renderSettings.width
      const yPercent = layerY / renderSettings.height
      const worldX = sceneCamera.inverseTransformX(xPercent * 100 - 50)
      const worldY = sceneCamera.inverseTransformY(yPercent * 100 - 50)
      if (worldX > rubberBandRestingPoint.x || worldY < rubberBandRestingPoint.y - 10) return dragRubberBandsTo(rubberBandRestingPoint.x, rubberBandRestingPoint.y)
      dragRubberBandsTo(worldX, worldY)
    })
    
    const matterPlugin = createMatterPlugin(entities)
    // End of main game setup
    const gameCore = createGameCore({
      plugins: [
        createGameLoop(),
        createPixiRenderer(entities, renderSettings),
        matterPlugin,
      ],
    });
    await gameCore.mount();
    console.log("Game Mounted");
  });
  return (
    <canvas
      style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"
      ref={canvas}
    />
  );
}
