/** @module main Main module */

import OSD from "./osd/osd.js"

/**
 * @param {Window} window
 */
export function main(window) {
	OSD.render(window)
}

if(typeof window !== "undefined") {
	main(window)
}
