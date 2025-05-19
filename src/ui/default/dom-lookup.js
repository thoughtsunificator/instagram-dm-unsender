/** @module dom-lookup Utils module for looking up elements on the default UI */

import { waitForElement } from "../../dom/async-events.js"

/**
 *
 * @param {Element} root
 * @param {AbortController} abortController
 * @returns {Promise<Element[]>}
 */
export function getFirstVisibleMessage(root, abortController) {
	const elements = [...root.querySelectorAll("div[role=row]:not([data-idmu-ignore])")]
		.filter(d => d.textContent.length > 3 && d.textContent.substring(0, 3) === "You")
	elements.reverse()
	console.debug("getFirstVisibleMessage", elements.length, "elements")
	for(const element of elements) {
		if(abortController.signal.aborted) {
			break
		}
		const visibilityCheck = element.checkVisibility({
			visibilityProperty: true,
			contentVisibilityAuto: true,
			opacityProperty: true,
		})
		if(visibilityCheck === false) {
			console.debug("visibilityCheck", visibilityCheck)
			continue
		}
		const isInView = element.getBoundingClientRect().y > 100
		if(isInView === false) {
			console.debug("isInView", isInView)
			continue
		}
		element.setAttribute("data-idmu-ignore", "") // Next iteration should not include this message
		console.debug("Message in view, testing workflow...", element)
		return element
	}
}

/**
 *
 * @param {Window} window
 * @returns {HTMLDivElement}
 */
export function findMessagesWrapper(window) {
	return window.document.querySelector("div[role=grid] > div > div > div > div")
}

/**
 *
 * @param {Element} root
 * @param {AbortController} abortController
 * @returns {Promise<boolean>}
 */
export async function loadMoreMessages(root, abortController) {
	console.debug("loadMoreMessages looking for loader... ")
	let findLoaderTimeout
	let loadingElement
	let resolveTimeout
	const scrollAbortController = new AbortController() // Separate abortController to stop scrolling if we can't find the loader in 10s
	const abortHandler = () => {
		scrollAbortController.abort()
		clearTimeout(findLoaderTimeout)
		if(resolveTimeout) {
			resolveTimeout()
		}
	}
	abortController.signal.addEventListener("abort", abortHandler)
	root.scrollTop = 0
	try {
		loadingElement = await Promise.race([
			waitForElement(root, () => {
				if(root.querySelector(`[role=progressbar]`) === null) {
					root.scrollTop = 0
				}
				return root.querySelector(`[role=progressbar]`)
			}, scrollAbortController),
			new Promise(resolve => {
				resolveTimeout = resolve
				findLoaderTimeout = setTimeout(() => { // TODO Replace with fetch override
					resolve()
				}, 10000) // IDMU_SCROLL_DETECTION_TIMEOUT
			})
		])
	} catch(ex) {
		console.error(ex)
	}
	scrollAbortController.abort() // If it took more than 10s stop scrolling
	abortController.signal.removeEventListener("abort", abortHandler)
	clearTimeout(findLoaderTimeout)
	if(loadingElement && loadingElement !== true) {
		console.debug("loadMoreMessages: Found loader; Stand-by until it is removed")
		console.debug("loadMoreMessages: scrollTop", root.scrollTop)
		await waitForElement(root, () => root.querySelector(`[role=progressbar]`) === null, abortController)
	}
	console.debug("loadMoreMessages: Loader was removed, older messages loading completed")
	console.debug(`loadMoreMessages: scrollTop is ${root.scrollTop} we ${root.scrollTop === 0 ? "reached last page" : "did not reach last page and will begin loading older messages shortly"}`, )
	return root.scrollTop === 0
}
