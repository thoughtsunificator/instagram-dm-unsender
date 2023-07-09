import { waitForElement } from "../../dom/async-events.js"

/**
 *
 * @param {Element} root
 * @returns {Promise<boolean>}
 */
export default async function loadMoreMessageStrategy(root) {
	console.debug("loadMoreMessageStrategy")
	root.scrollTop = 999
	root.scrollTop = 0
	let findLoaderTimeout
	const loadingElement = await Promise.race([
		waitForElement(root, () => root.querySelector(`[role=progressbar]`)),
		new Promise(resolve => {
			findLoaderTimeout = setTimeout(resolve, 500)
		})
	])
	clearTimeout(findLoaderTimeout)
	if(loadingElement) {
		console.debug("loadMoreMessageStrategy: Found loader; Stand by until until it is removed")
		console.debug("loadMoreMessageStrategy: scrollTop", root.scrollTop)
		await waitForElement(root, () => root.querySelector(`[role=progressbar]`) === null)
		console.debug("loadMoreMessageStrategy: Loader was removed, older messages loading completed")
		console.debug(`loadMoreMessageStrategy: scrollTop is ${root.scrollTop} we ${root.scrollTop === 0 ? "reached last page" : " did not reach last page and will begin loading older messages shortly"}`, )
		return root.scrollTop === 0
	} else {
		console.debug("loadMoreMessageStrategy: Could not find loader")
		return true
	}
}
