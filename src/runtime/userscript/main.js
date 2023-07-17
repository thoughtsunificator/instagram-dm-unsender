import UI from "./ui/ui.js"

export function main(window) {
	if(!window.IDMU_DEBUG) {
		console.debug = () => {}
	}

	UI.render(window)
}

if(typeof window !== "undefined") {
	main(window)
}
