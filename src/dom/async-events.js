/** @module async-events Utils module for finding elements asynchronously in the DOM */

/**
 *
 * @callback getElement
 * @returns {Element}
 */

/**
 *
 * @param {Element} target
 * @param {getElement} getElement
 * @param {AbortController} abortController
 * @returns {Promise<Element>}
 */
export function waitForElement(target, getElement, abortController) {
	return new Promise((resolve, reject) => {
		let mutationObserver
		const abortHandler = () => {
			if(mutationObserver) {
				reject(new DOMException("Aborted: Disconnecting mutation observer...", "AbortError"))
				mutationObserver.disconnect()
			} else {
				reject(new DOMException("Aborted", "AbortError"))
			}
		}
		abortController.signal.addEventListener("abort", abortHandler)
		let element = getElement()
		if(element) {
			resolve(element)
			abortController.signal.removeEventListener("abort", abortHandler)
		} else {
			mutationObserver = new MutationObserver((mutations, observer) => {
				element = getElement(mutations)
				if(element) {
					observer.disconnect()
					resolve(element)
					abortController.signal.removeEventListener("abort", abortHandler)
				}
			})
			mutationObserver.observe(target, { subtree: true, childList:true })
		}
	})
}

/**
 *
 * @param {Element} clickTarget
 * @param {Element} target
 * @param {getElement} getElement
 * @param {AbortController} abortController
 * @returns {Element|Promise<Element>}
 */
export function clickElementAndWaitFor(clickTarget, target, getElement, abortController) {
	const promise = waitForElement(target, getElement, abortController)
	clickTarget.click()
	return getElement() || promise
}
