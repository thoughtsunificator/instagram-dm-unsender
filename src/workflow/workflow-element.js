import { waitForElement, clickElementAndWaitFor } from "../dom/async-events.js"

export { WorkflowElement }

/**
 *
 * @param {Element}          root
 * @param {WorkflowDocument} workflowDocument
 */
function WorkflowElement(root, workflowDocument)  {
	this.root = root
	this.workflowDocument = workflowDocument
}

/**
 * @param {Element} target
 * @param {function} getElement
 * @param {AbortController} abortController
 * @returns {Promise<Element>}
 */
WorkflowElement.prototype.waitForElement = function(target, getElement, abortController) {
	return getElement() || waitForElement(target, getElement, abortController)
}

/**
 * @param {Element} clickTarget
 * @param {Element} target
 * @param {function} getElement
 * @param {AbortController} abortController
 * @returns {Promise<Element>}
 */
WorkflowElement.prototype.clickElementAndWaitFor = function(clickTarget, target, getElement, abortController) {
	return clickElementAndWaitFor(clickTarget, target, getElement, abortController)
}
