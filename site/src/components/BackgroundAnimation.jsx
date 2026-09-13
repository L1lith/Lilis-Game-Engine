import { EntityList, Entity, createGameLoop, createGameCore, RenderSettings } from 'lilis-engine'
import { onMount } from "solid-js"
import { isServer } from 'solid-js/web'
import createPixiRenderer from 'lilis-engine/pixi'
import randomBetween from '@/utility/randomBetween'
import '@/styles/BackgroundAnimation.scss'
import { Assets } from 'pixi.js'

export default function BackgroundAnimation() {
    let canvas, unmountGameEngine
    onMount(async ()=>{
        if (isServer) return
        const renderSettings = new RenderSettings({canvas, appOptions: {backgroundAlpha: 0}})
        const entities = EntityList()
        const bubbles = entities.addChild(EntityList())
        const autoResize = () => {
            renderSettings.width = window.innerWidth
            renderSettings.height = window.innerHeight
            const widthRatio = Math.max(window.innerWidth / window.innerHeight, 1)
            const heightRatio = Math.max(window.innerHeight / window.innerWidth, 1)
            bubbles.get().forEach(bubble => {
                bubble.width = bubble.size * heightRatio
                bubbly.height = bubble.size * widthRatio
            })
        };
        window.addEventListener("resize", autoResize);
        autoResize()
        
        window.entities = entities
        window.bubbles = bubbles
        // Main Game Logic
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

        const floatRate = 0.5
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
        const pixiRenderer = createPixiRenderer(entities, renderSettings)
        const gameLoop = createGameLoop()
        const gameCore = createGameCore({plugins:[pixiRenderer, gameLoop, floatBubblesPlugin]})
        await gameCore.mount()
        unmountGameEngine = gameCore.unmount
    })
    return <canvas class="background-animation" ref={canvas} style="z-index: -1;"/>
}