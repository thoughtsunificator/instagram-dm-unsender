import { waitForElement } from "../../dom/async-events.js"

/**
 *
 * @param {Element} root
 * @returns {Promise<boolean>}
 */
export default async function loadMoreMessageStrategy(root) {
	console.debug("lodMoreMessageStrategy")
	root.scrollTop = 999
	root.scrollTop = 0
	let findLoaderTimeout
	const loadingElement = await Promise.race([
		waitForElement(root, () => root.ownerDocument.body.querySelector(`[role=progressbar]`)),
		new Promise(resolve => {
			findLoaderTimeout = setTimeout(resolve, 500)
		})
	])
	clearTimeout(findLoaderTimeout)
	if(loadingElement) {
		console.debug("Found loader; waiting for messages mutations")
		console.debug("scrollTop", root.scrollTop)
		const hasReachedLastPage = await waitForElement(root, () => root.scrollTop !== 0)
		console.debug("hasReachedLastPage", hasReachedLastPage)
		console.debug("scrollTop", root.scrollTop)
		return root.scrollTop === 0
	} else {
		console.debug("Could not find loader")
		return true
	}
}
