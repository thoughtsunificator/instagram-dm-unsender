/**
 *
 * @callback getElement
 * @returns {Element}
 */

/**
 *
 * @param {Element} target
 * @param {getElement} getElement
 * @returns {Promise<Element>}
 */
export function waitForElement(target, getElement) {
	return new Promise((resolve) => {
		let element = getElement()
		if(element) {
			resolve(element)
		} else {
			new MutationObserver((mutations, observer) => {
				element = getElement()
				if(element) {
					observer.disconnect()
					resolve(element)
				}
			}).observe(target, { subtree: true, childList:true })
		}
	})
}

/**
 *
 * @param {Element} clickTarget
 * @param {Element} target
 * @param {getElement} getElement
 * @returns {Element|Promise<Element>}
 */
export function clickElementAndWaitFor(clickTarget, target, getElement) {
	const promise = waitForElement(target, getElement)
	clickTarget.click()
	return getElement() || promise
}
