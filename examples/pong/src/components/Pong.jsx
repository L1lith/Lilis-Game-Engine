import { onMount } from "solid-js";
import { isServer } from "solid-js/web";
import {
  createGameCore,
  Entity,
  EntityList,
  RenderSettings,
  createGameLoop,
  createEntityList,
} from "lilis-engine";
import {detectKeys} from 'lilis-engine/utility'
import createMatterPlugin from "lilis-engine/matter";
import createP5Renderer from "lilis-engine/p5";
import {Signal} from 'jabr'
import Matter from "matter-js";
Matter.Resolver._restingThresh = 0.001
const {Body} = Matter

export default function Pong() {
  let canvas;
  onMount(async () => {
    if (isServer) return;
    const entities = (window.entities = createEntityList([]));
    const renderSettings = RenderSettings({
      canvas,
      calculateDimensions: (width, height) => [
        Math.min(width, height),
        Math.min(width, height),
      ],
    });
    renderSettings.p = (p) => {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
    };
    // Write the main game code
    entities.addChild(
      Entity({
        // Background
        shape: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fill: "#000000",
      }),
    );
    const leftPaddle = entities.addChild(
      Entity({
        shape: "rect",
        matter: {
          shape: "rectangle",
          static: true,
          restitution: 1,
          friction: 0,
        },
        x: -40,
        y: 0,
        width: 2,
        height: 10,
        fill: "#85e8ff",
      }),
    );

    const rightPaddle = entities.addChild(
      Entity({
        shape: "rect",
        matter: {
          shape: "rectangle",
          static: true,
          restitution: 1,
          //mass: 1,
          friction: 0,
        },
        x: 40,
        y: 0,
        width: 2,
        height: 10,
        fill: "#85ffba",
      }),
    );

    const targetSpeed = Signal(1)
    const ball = entities.addChild(
      Entity({
        shape: "ellipse",
        matter: {
          shape: "circle",
          friction: 0,
          restitution: 1,
          frictionAir: 0,
          //mass: 1,
          inertia: Infinity
        },
        x: 0,
        y: 0,
        width: 2.5,
        height: 2.5,
        fill: "white",
      }),
    );
    const topWall = entities.addChild(
      Entity({
        matter: {
          shape: "rectangle",
          static: true,
          restitution: 1,
          friction: 0,
          mass: 1
        },
        x: 0,
        y: -51,
        width: 100,
        height: 2,
      }),
    );

    const bottomWall = window.bottomWall = entities.addChild(
      Entity({
        matter: {
          shape: "rectangle",
          static: true,
          restitution: 1,
          friction: 0,
          mass: 1,
          inertia: Infinity
        },
        x: 0,
        y: 54,
        width: 100,
        height: 8,
      }),
    );
    const matterPlugin = createMatterPlugin(entities, {
      setup: (engine) => {
        engine.gravity.x = 0;
        engine.gravity.y = 0;
        leftPaddle.y = 0;
        rightPaddle.y = 0;
        engine.velocityIterations = 20
      },
    });

    const handlePlayerScore = (winner) => {
        console.log(`Player ${winner} scored!`)
    }

    const ballManager = {
        tick: ()=>{
            const isOffscreenLeft = ball.x < -50
            const isOffscreenRight = ball.x > 50
            if (isOffscreenLeft || isOffscreenRight) {
                ball.x = 0
                ball.y = 0
                handlePlayerScore(isOffscreenLeft ? 2 : 1)
            }
            if (Body.getSpeed(ball.matterBody) === 0 || isOffscreenLeft || isOffscreenRight) {
                ball.matterBody.force.x = 0.000025 * (Math.random() < 0.5 ? -1 : 1)
                ball.matterBody.force.y = 0.000025 * (Math.random() < 0.5 ? -1 : 1)
                
                //Body.setVelocity(ball.matterBody, {x: 0.5 * Math.random() + 0.3, y: 0 /*0.5 * Math.random()*/})
            } else {

            }// else if (Body.getSpeed(ball.matterBody) < 0.5) {
            Body.setSpeed(ball.matterBody, 1.1)
            //     //Body.setSpeed(ball.matterBody, 1)
            // }
            // console.log(Body.getSpeed(ball.matterBody))
           //Body.setSpeed(ball.matterBody, targetSpeed.get())
        }
    }

    const player1Controls = {up: detectKeys('w'), down: detectKeys('s')}
    const player2Controls = {up: detectKeys('ArrowUp'), down: detectKeys('ArrowDown')}

    const playerSpeed = 2
    const enforceBounds = (paddleY, entity) => Math.min(50 - entity.height / 2, Math.max(-50 + entity.height / 2, paddleY))
    const playerController = {
        tick: ()=>{
            const player1Direction = player1Controls.up.get() ? -1 : player1Controls.down.get() ? 1 : 0
            const player2Direction = player2Controls.up.get() ? -1 : player2Controls.down.get() ? 1 : 0
            leftPaddle.y = enforceBounds(leftPaddle.y + player1Direction * playerSpeed, leftPaddle)
            rightPaddle.y = enforceBounds(rightPaddle.y + player2Direction * playerSpeed, rightPaddle)
        }
    }
    
    // End of main game setup
    const gameCore = createGameCore({
      plugins: [
        createGameLoop(),
        createP5Renderer(entities, renderSettings),
        matterPlugin,
        ballManager,
        playerController
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
