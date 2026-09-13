import { EntityList, Entity, createGameLoop, createGameCore, RenderSettings } from 'lilis-engine'
import lilisEnginePackage from '../../node_modules/lilis-engine/package.json' with {type: 'json'}
import { onMount } from "solid-js"
import { isServer } from 'solid-js/web'
import createPixiRenderer from 'lilis-engine/pixi'
import randomBetween from '@/utility/randomBetween'
import '@/styles/BackgroundAnimation.scss'
import { Assets, Texture, DisplacementFilter, Sprite} from 'pixi.js'
import { GodrayFilter, AsciiFilter, AdjustmentFilter, CRTFilter} from 'pixi-filters'

function createBackgroundTexture() {
  // adjust it if somehow you need better quality for very very big images
  const quality = 256;
  const canvas = document.createElement('canvas');

  canvas.width = 1;
  canvas.height = quality;

  const ctx = canvas.getContext('2d');
  // use canvas2d API to create gradient
  const grd = ctx.createLinearGradient(0, 0, 0, quality);

  grd.addColorStop(0, 'rgb(16, 0, 52)');
  grd.addColorStop(1, '#004600');

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 1, quality);

  return Texture.from(canvas);
}

export default function BackgroundAnimation() {
    let canvas, unmountGameEngine
    onMount(async ()=>{
        if (isServer) return
        console.log("Current Engine Version: " + lilisEnginePackage.version)
        const renderSettings = new RenderSettings({canvas/*, appOptions: {backgroundAlpha: 0}*/})
        const entities = EntityList()
        const pixiRenderer = createPixiRenderer(entities, renderSettings)
        const bubbles = entities.addChild(EntityList())
        const godrayFilter = new GodrayFilter({ gain: 0.5, parallel: false, alpha: 0.5, center: {x: 1000, y: -100}})
        const crtFilter = new CRTFilter({vignetting: 0.42})
        const autoResize = () => {
            renderSettings.width = window.innerWidth
            renderSettings.height = window.innerHeight
            const widthRatio = Math.max(window.innerWidth / window.innerHeight, 1)
            const heightRatio = Math.max(window.innerHeight / window.innerWidth, 1)
            godrayFilter.center.x = window.innerWidth
            godrayFilter.center.y = 0 - window.innerHeight * .5
            bubbles.get().forEach(bubble => {
                bubble.width = bubble.size * heightRatio
                bubble.height = bubble.size * widthRatio
            })
        };
        window.addEventListener("resize", autoResize);
        autoResize()
        
        window.entities = entities
        window.bubbles = bubbles
        // Main Game Logic
        const background = entities.addChild(Entity({
            texture: createBackgroundTexture(),
            width: 100,
            height: 100,
            x: 0,
            y: 0,
            //rotation: Math.PI / 2
        }))
        const displacementMap = new Sprite(await Assets.load(import.meta.env.BASE_URL + 'displacement_map.png'))
        pixiRenderer.stage.addListener(stage => {
            if (!stage) return
            stage.filters = [new DisplacementFilter(displacementMap), godrayFilter, new AdjustmentFilter({brightness: 0.8}), crtFilter]
        })
        const bubbleTextures = await Promise.all(Array.from(Array(6)).map(async (_, n) => {
            return await Assets.load(import.meta.env.BASE_URL + 'backgroundAnimation/abubble' + (n + 1) + '.png')
        }))
        window.bubbleTextures = bubbleTextures
        const createRandomBubble = (entityOptions={})=>{
            const wiggleSpeed = randomBetween(200, 1000)
            const spawnX = randomBetween(-50, 50)
            const size = Math.random() * 5 + 2
            const widthRatio = Math.max(window.innerWidth / window.innerHeight, 1)
            const heightRatio = Math.max(window.innerHeight / window.innerWidth, 1)
            bubbles.addChild(Entity({
                texture: bubbleTextures[randomBetween(0, bubbleTextures.length - 1)],
                width: size * heightRatio,
                height: size * widthRatio,
                x: spawnX,
                spawnX,
                size,
                wiggleSpeed,
                y: 50,
                birth: Date.now(),
                ...entityOptions
            }))
        }

        const floatRate = 0.25
        const animateFiltersPlugin = {
            tick: ({lifespan}) => {
                godrayFilter.time = lifespan / 3000
                crtFilter.time = lifespan / 500
            }
        }
        const floatBubblesPlugin = {
            tick: ()=>{
                if (Math.random() < 0.05) createRandomBubble()
                
                const toRemove = []
                const currentBubbles = bubbles.get()  // snapshot
                for (const bubble of currentBubbles) {
                    const newY = bubble.y - floatRate
                    bubble.y = newY
                    const age = Date.now() - bubble.birth
                    bubble.x = bubble.spawnX + Math.sin(age / bubble.wiggleSpeed) * 10 - 5
                    if (newY < -50 - (bubble.height ?? 5) / 2) {
                        toRemove.push(bubble)
                    }
                }
                // Remove AFTER iterating
                for (const bubble of toRemove) {
                    bubbles.removeChild(bubble)
                }
            }
        }


        // End Main Game Logic
        const gameLoop = createGameLoop()
        const gameCore = createGameCore({plugins:[pixiRenderer, gameLoop, floatBubblesPlugin, animateFiltersPlugin]})
        await gameCore.mount()
        unmountGameEngine = gameCore.unmount
    })
    return <canvas class="background-animation" ref={canvas} style="z-index: -1;"/>
}