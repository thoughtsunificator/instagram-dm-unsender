import UI from "./ui/ui.js"

export function main(window) {
	UI.render(window)
}

if(typeof window !== "undefined") {
	main(window)
}
