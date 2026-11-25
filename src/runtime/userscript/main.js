/**
 * Entrypoint for the userscript runtime
 */
import { startFeatures } from "./features.js"

export { main }

/**
 * @param {Window} window
 * @returns {object[]} the started features
 */
function main(window) {
	return startFeatures(window)
}

/**
 * Run in realms where Window global object is defined
 */
if(typeof window !== "undefined") {
	main(window)
}
