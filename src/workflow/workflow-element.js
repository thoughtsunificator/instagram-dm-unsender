import { waitForElementWithTimeout, clickElementAndWaitForWithTimeout } from "../dom/async-events.js"

export { WorkflowElement }

/**
 * Base for any DOM element a workflow acts upon.
 *
 * @param {Element} root
 */
function WorkflowElement(root) {
	this.root = root
}

/** Default timeout for an element to show up after an action */
WorkflowElement.TIMEOUT_MS = 3000

/**
 * @param {Element}            target
 * @param {function}           getElement
 * @param {AbortController}    abortController
 * @param {number}             [timeoutMs]
 * @returns {Promise<Element>}
 */
WorkflowElement.prototype.waitForElement = function(target, getElement, abortController, timeoutMs = WorkflowElement.TIMEOUT_MS) {
	return waitForElementWithTimeout(target, getElement, timeoutMs, abortController)
}

/**
 * @param {Element}         clickTarget
 * @param {Element}         target
 * @param {function}        getElement
 * @param {AbortController} abortController
 * @param {number}          [timeoutMs]
 * @returns {Promise<Element>}
 */
WorkflowElement.prototype.clickElementAndWaitFor = function(clickTarget, target, getElement, abortController, timeoutMs = WorkflowElement.TIMEOUT_MS) {
	return clickElementAndWaitForWithTimeout(clickTarget, target, getElement, timeoutMs, abortController)
}
