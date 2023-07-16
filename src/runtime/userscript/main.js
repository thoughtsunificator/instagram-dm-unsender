import UI from "./ui/ui.js"

if(!window.IDMU_DEBUG) {
	console.debug = () => {}
}

UI.render(window)
