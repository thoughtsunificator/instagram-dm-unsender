import { UnsendFeature } from "./features/unsend/unsend-feature.js"

export { startFeatures, FEATURES }

/**
 * Every feature of the userscript. Each one is started on the page
 */
const FEATURES = [UnsendFeature]

/**
 * @param {Window} window
 * @returns {object[]} the started features
 */
function startFeatures(window) {
	return FEATURES.map(Feature => {
		const feature = new Feature(window)
		feature.start()
		return feature
	})
}
