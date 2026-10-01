import { onMount, onCleanup, createSignal} from "solid-js"
import { isServer } from 'solid-js/web'
import {createGameCore, Entity, EntityList, RenderSettings, createGameLoop, Camera} from 'lilis-engine'
import createPixiRenderer from 'lilis-engine/pixi'
import createSolidRenderer from 'lilis-engine/solid'
import '@/styles/Game.scss'
import createMatterPlugin from 'lilis-engine/matter'
import { detectKeys } from "lilis-engine/utility"
import Matter from 'matter-js'
import MatterAttractors from 'matter-attractors'
const {Body, Common, Mouse, Events} = Matter

// Adapted from here: https://liabru.github.io/matter-attractors/#basic

export default function Game() {
    const [solidGameContents, setSolidGameContents] = createSignal(null)
    let pixiCanvas
    let unmountGameEngine
    let matterCanvas
    onMount(async ()=>{
        if (isServer) return
        console.log('Mounted!')
        const pixiRenderSettings = RenderSettings({canvas: pixiCanvas})
        const matterRenderSettings = RenderSettings({canvas: matterCanvas, renderOptions: {
            wireframes: false
        }, transparentBackground: true, setup: engine => {
            engine.world.gravity.scale = 0
        }})
        const scaleCamera = Camera()
        const autoResize = () => {
        const size = Math.min(window.innerWidth, window.innerHeight);
            scaleCamera.width = scaleCamera.height = pixiRenderSettings.width = pixiRenderSettings.height = matterRenderSettings.width = matterRenderSettings.height = size;
        };
        window.addEventListener("resize", autoResize);
        autoResize();
        const entities = EntityList([])
        const background = entities.addChild(Entity({
            imageURL: 'space-bg.jpg',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            renderPriority: -100
        }))
        const cursorShape = entities.addChild(Entity({
            x: 0,
            y: 0,
            width: 15,
            height: 15,
            imageURL: import.meta.env.BASE_URL + 'magnet-circle.png',
            noMatterRender: true,
            matter: {
                shape: 'circle',
                static: true,
                plugin: {
                    attractors: [
                        function(bodyA, bodyB) {
                            return {
                                x: (bodyA.position.x - bodyB.position.x) * 1e-6,
                                y: (bodyA.position.y - bodyB.position.y) * 1e-6,
                            };
                        }
                    ]
                }
            }
        }))
        for (var i = 0; i < 100; i += 1) {
            const sides = Common.random(3, 5)
            const size = Math.pow(Math.random(), 2) * 5 + 2
            entities.addChild(Entity({
                x: Common.random(-50, +50), 
                y: Common.random(-50, +50),
                width: size,
                height: size,
                matter: {
                    shape: 'polygon',
                    sides // old radius: Common.random() > 0.9 ? Common.random(15, 25) : Common.random(5, 10)
                }
            }))
        }

        // add mouse control
        var mouse = Mouse.create(matterRenderSettings.canvas);
        const mouseControlPlugin = {
            tick: ()=>{
                if (!cursorShape.matterBody || !isFinite(cursorShape.matterBody.position.x) || cursorShape.matterBody.position.x === null) return
                const cursorWorldX = scaleCamera.transformX(mouse.position.x) - 50
                const cursorWorldY = scaleCamera.transformY(mouse.position.y) - 50
                // smoothly move the attractor body towards the mouse
                //cursorShape.x = 
                Body.translate(cursorShape.matterBody, {
                    x: (cursorWorldX - cursorShape.matterBody.position.x) * 0.25,
                    y: (cursorWorldY - cursorShape.matterBody.position.y) * 0.25
                });
            },
            tickPriority: 100
        }
        const pixiRenderer = createPixiRenderer(entities, pixiRenderSettings)
        const solidRenderer = createSolidRenderer(entities, {solidSetter: setSolidGameContents})
        const matterPhysics = createMatterPlugin(entities, matterRenderSettings)
        matterPhysics.useMatterPlugin(MatterAttractors)
        const gameCore = createGameCore({plugins:[createGameLoop(), pixiRenderer, solidRenderer, matterPhysics, mouseControlPlugin]})
        await gameCore.mount()
        unmountGameEngine = gameCore.unmount
    })
    onCleanup(async ()=>{
        if (isServer) return // Browser Only, shut down the game engine. Not technically mandatory but good practice and shows how to gracefully shut down the game engine
        await unmountGameEngine()
    })
    return (<div class="game-container">
        <canvas class="pixi-canvas" ref={pixiCanvas}/>
        <canvas class="matter-canvas" ref={matterCanvas}/>
        {solidGameContents()}
    </div>)
}