/** @module main Main module */

import UI from "./ui/ui.js"

/**
 * @param {Window} window
 */
export function main(window) {
	UI.render(window)
}

if(typeof window !== "undefined") {
	main(window)
}
