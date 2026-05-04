/**
 * Entrypoint for the userscript runtime
 */
import { UnsendFeature } from "./features/unsend/unsend-feature.js"

export { main }

/**
 * @param {Window} window
 */
function main(window) {
	UnsendFeature(window)
}

/**
 * Run in realms where Window global object is defined
 */
if(typeof window !== "undefined") {
	main(window)
}
