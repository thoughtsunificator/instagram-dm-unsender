import { waitForElement } from "../../dom/async-events.js"

/**
 *
 * @param {Element} root
 * @returns {Promise<boolean>}
 */
export default async function loadMoreMessageStrategy(root) {
	console.debug("loadMoreMessageStrategy")
	root.scrollTop = 0
	const loadingElement = await Promise.race([
		waitForElement(root, () => root.ownerDocument.body.querySelector(`[aria-label="Loading..."]`)), // TODO i18n
		new Promise(resolve => setTimeout(resolve, 500))
	])
	if(loadingElement) {
		console.debug("Found loader; waiting for messages mutations")
		console.debug("scrollTop", root.scrollTop)
		const hasReachedLastPage = await Promise.race([
			waitForElement(root, () => root.scrollTop !== 0),
			new Promise(resolve => setTimeout(() => resolve(true), root.ownerDocument.defaultView.IDMU_SCROLL_DETECTION_TIMEOUT))
		])
		console.debug("hasReachedLastPage", hasReachedLastPage)
		console.debug("scrollTop", root.scrollTop)
		return root.scrollTop === 0
	} else {
		console.debug("Could not find loader")
		return true
	}
}
