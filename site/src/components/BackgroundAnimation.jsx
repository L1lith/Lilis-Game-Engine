import { EntityList, Entity, createGameLoop, createGameCore, RenderSettings } from 'lilis-engine'
import { onMount } from "solid-js"
import { isServer } from 'solid-js/web'
import createPixiRenderer from 'lilis-engine/pixi'
import randomBetween from '@/utility/randomBetween'
import '@/styles/BackgroundAnimation.scss'

export default function BackgroundAnimation() {
    let canvas, unmountGameEngine
    onMount(async ()=>{
        if (isServer) return
        const renderSettings = new RenderSettings({canvas, appOptions: {backgroundAlpha: 0}})        
        const autoResize = () => {
            renderSettings.width = window.innerWidth
            renderSettings.height = window.innerHeight
        };
        window.addEventListener("resize", autoResize);
        const entities = EntityList()
        const bubbles = EntityList()
        entities.addChild(bubbles)
        window.entities = entities
        window.bubbles = bubbles
        // Main Game Logic
        const createRandomBubble = (entityOptions={})=>{
            console.log('creating bubble')
            bubbles.addChild(Entity({
                imageURL: import.meta.env.BASE_URL + '/backgroundAnimation/abubble' + randomBetween(1, 6) + '.png',
                width: 5,
                height: 5,
                x: randomBetween(-50, 50),
                y: 50,
                ...entityOptions
            }))
        }

        const floatRate = 0.5
        const floatBubblesPlugin = {
            tick: ()=>{
                if (Math.random() < 0.05) createRandomBubble()
                bubbles.get().forEach(bubble => {
                    bubble.y = bubble.y - floatRate
                    if (bubble.y < -50 - bubble.height / 2) {
                        console.log('clearing bubble')
                        bubbles.removeChild(bubble)
                    }
                })
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