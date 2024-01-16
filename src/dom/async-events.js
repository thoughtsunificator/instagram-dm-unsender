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
export function waitForElement(target, getElement, controller=new AbortController()) {
	if (controller.signal?.aborted){
		return Promise.reject(new DOMException("Aborted", "AbortError"))
	}
	return new Promise((resolve, reject) => {
		let mutationObserver
		const abortHandler = () => {
			reject(new DOMException("Aborted", "AbortError"))
			if(mutationObserver) {
				mutationObserver.disconnect()
			}
		}
		controller.signal?.addEventListener("abort", abortHandler)
		let element = getElement()
		if(element) {
			resolve(element)
			controller.signal?.removeEventListener("abort", abortHandler)
		} else {
			mutationObserver = new MutationObserver((mutations, observer) => {
				element = getElement()
				if(element) {
					observer.disconnect()
					resolve(element)
					controller.signal?.removeEventListener("abort", abortHandler)
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
 * @returns {Element|Promise<Element>}
 */
export function clickElementAndWaitFor(clickTarget, target, getElement) {
	const promise = waitForElement(target, getElement)
	clickTarget.click()
	return getElement() || promise
}
