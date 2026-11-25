export { waitForElement, clickElementAndWaitFor, waitForElementWithTimeout, clickElementAndWaitForWithTimeout }

/**
 *
 * @callback getElementCallback
 * @param {MutationRecord[]} [mutations] - Present when called from a MutationObserver
 * @returns {Element|null|undefined|boolean}
 */

/**
 * Run a callback on DOM mutation (addedNode) that tests whether a specific element was found (or was not found)
 * When the callback returns a truthy value the promise is resolved with it
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
		const abortHandler = () => {
			observer?.disconnect()
			reject(new Error(`waitForElement aborted: ${abortController.signal.reason}`))
		}
		if(abortController.signal.aborted) {
			abortHandler()
			return
		}
		abortController.signal.addEventListener("abort", abortHandler)
		const element = getElement()
		if(element) {
			abortController.signal.removeEventListener("abort", abortHandler)
			resolve(element)
			return
		}
		const observer = new MutationObserver((mutations) => {
			const found = getElement(mutations)
			if(found) {
				observer.disconnect()
				abortController.signal.removeEventListener("abort", abortHandler)
				resolve(found)
			}
		})
		observer.observe(target, { subtree: true, childList: true })
	})
}

/**
 * Click target and run waitForElement
 *
 * @param {Element} clickTarget
 * @param {Element} target
 * @param {getElementCallback} getElement
 * @param {AbortController} abortController
 * @returns {Promise<Element>}
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
	// Start observing before clicking so that mutations caused by the click are not missed
	const promise = waitForElement(target, getElement, abortController)
	clickTarget.click()
	return promise
}

/**
 * Runs task with a child AbortController that is aborted when the parent is aborted
 * or when timeoutMs elapses (whichever comes first).
 *
 * @param {AbortController} abortController
 * @param {number}          timeoutMs
 * @param {function(AbortController): Promise} task
 * @returns {Promise}
 */
function withinTimeout(abortController, timeoutMs, task) {
	const child = new AbortController()
	const abortChild = () => child.abort(abortController.signal.reason)
	if(abortController.signal.aborted) {
		abortChild()
	} else {
		abortController.signal.addEventListener("abort", abortChild)
	}
	// The task starts synchronously (e.g. the click of clickElementAndWaitFor) and the timer is armed after it
	let promise
	try {
		promise = Promise.resolve(task(child))
	} catch(error) {
		promise = Promise.reject(error)
	}
	const timer = setTimeout(() => child.abort(`Timeout after ${timeoutMs}ms`), timeoutMs)
	return promise.finally(() => {
		clearTimeout(timer)
		abortController.signal.removeEventListener("abort", abortChild)
	})
}

/**
 * waitForElement that rejects after timeoutMs
 *
 * @param {Element}            target
 * @param {getElementCallback} getElement
 * @param {number}             timeoutMs
 * @param {AbortController}    abortController
 * @returns {Promise<Element>}
 */
function waitForElementWithTimeout(target, getElement, timeoutMs, abortController) {
	return withinTimeout(abortController, timeoutMs, (child) => waitForElement(target, getElement, child))
}

/**
 * clickElementAndWaitFor that rejects after timeoutMs
 *
 * @param {Element}            clickTarget
 * @param {Element}            target
 * @param {getElementCallback} getElement
 * @param {number}             timeoutMs
 * @param {AbortController}    abortController
 * @returns {Promise<Element>}
 */
function clickElementAndWaitForWithTimeout(clickTarget, target, getElement, timeoutMs, abortController) {
	return withinTimeout(abortController, timeoutMs, (child) => clickElementAndWaitFor(clickTarget, target, getElement, child))
}
