export { waitForElement, clickElementAndWaitFor }

/**
 *
 * @callback getElementCallback
 * @returns {Element}
 */

/**
 * Run a callback on DOM mutation (addedNode) that tests whether a specific element was found (or was not found)
 * When the callback returns true the promise is resolved
 *
 * @param {Element}            target
 * @param {getElementCallback} getElement
 * @param {AbortController}    abortController
 * @returns {Promise<Element>}
 *
 * @example
 * waitForElement(
 *		body,
 *		() => body.contains(document.querySelector("button#foo")),
 *		abortController
 *	)
 */
function waitForElement(target, getElement, abortController) {
	return new Promise((resolve, reject) => {
		let mutationObserver
		const abortHandler = () => {
			if(mutationObserver) {
				mutationObserver.disconnect()
			}
			reject(new Error(`waitForElement aborted: ${abortController.signal.reason}`))
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
			mutationObserver.observe(target, { subtree: true, childList: true })
		}
	})
}

/**
 * Click target and run waitForElement
 *
 * @param {Element} clickTarget
 * @param {Element} target
 * @param {getElement} getElement
 * @param {AbortController} abortController
 * @returns {Element|Promise<Element>}
 *
 * @example
 * In this case clicking "#foo" button would make "#bar" appear
 * clickElementAndWaitFor(
 *		document.querySelector("#foo"),
 *		body,
 *		() => body.contains(document.querySelector("#bar")),
 *		abortController
 *	)
 */
function clickElementAndWaitFor(clickTarget, target, getElement, abortController) {
	const promise = waitForElement(target, getElement, abortController)
	clickTarget.click()
	return getElement() || promise
}
