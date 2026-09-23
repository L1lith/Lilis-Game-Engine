---
name: SolidJS
homePage: https://www.solidjs.com/
category: Renderer Plugins
description: Create dynamic GUIs using interactive HTML
demos: ['solid-plugin-demo', 'level-loader-demo', 'topdown', 'sidescroller', 'spike-vs-space']
---
The SolidJS renderer is very straightforward if you know how to use SolidJS. First we create a signal that will be used to define where the Solid contents will be outputted inside your SolidJS application. First provide the setter method to the plugin initialization, and then the getter of that method is used to define where all of the SolidJS contents will be outputted in the DOM. In the [topdown demo](https://github.com/L1lith/Lilis-Game-Engine/blob/master/demos/topdown/src/components/Game.jsx) we can see what that looks like in our main game component: 
```jsx
export default function Game() {
    const [solidGameContents, setSolidGameContents] = createSignal(null)
	onMount(async ()=>{
        if (isServer) return
		const entities = EntityList([])
		const renderSettings = RenderSettings({canvas})
		renderSettings.solidSetter = setSolidGameContents
		const solidRenderer = createSolidRenderer(entities, renderSettings)
	})
    return (<div class="game-container">
        <canvas ref={canvas}/>
        {solidGameContents()}
    </div>)
}
```

Any Entity can render a component to the screen by setting that component as it's `.solid` property. That Entity will be passed to the component automatically through the `{entity}` prop. Since we've done the above SolidJS plugin setup all we need to do now is this:
```js
const touchControls = entities.addChild({solid: TouchControls})
```
The TouchControls component can modify it's `{entity}` prop to change the values of the `touchControls` Entity, and we can read and listen to changes in those values. To make those touch controls affect the player movement for example we can define a custom plugin that changes the player's matter momentum based on the values of the touchControls Entity each tick:
```js
const playerControlPlugin = {
	tick: () => {
		if (!player.matterBody) return
		Body.setVelocity(player.matterBody, {x: touchControls.xDirection * walkForce, y: touchControls.yDirection * walkForce})
	}
}
// Also we will add it to our gameCore plugin list below
```