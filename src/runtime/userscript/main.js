import { render } from "./ui/ui.js"

if(!window.IDMU_DEBUG) {
	console.debug = () => {}
}

render(window)
