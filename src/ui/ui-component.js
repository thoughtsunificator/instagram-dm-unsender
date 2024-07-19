/** @module ui-component Base class for any element that is a part of the UI. */

import { waitForElement, clickElementAndWaitFor } from "../dom/async-events.js"

/**
 *
 * @abstract
 */
class UIComponent {
	/**
	 *
	 * @param {Element} root
	 * @param {object} identifier
	 */
	constructor(root, identifier={}) {
		this.root = root
		this.identifier = identifier
	}

	/**
	 *
	 * @param {Element} target
	 * @param {function} getElement
	 * @param {AbortController} abortController
	 * @returns {Promise<Element>}
	 */
	waitForElement(target, getElement, abortController) {
		return getElement() || waitForElement(target, getElement, abortController)
	}

	/**
	 *
	 * @param {Element} clickTarget
	 * @param {Element} target
	 * @param {function} getElement
	 * @param {AbortController} abortController
	 * @returns {Promise<Element>}
	 */
	clickElementAndWaitFor(clickTarget, target, getElement, abortController) {
		return clickElementAndWaitFor(clickTarget, target, getElement, abortController)
	}

}

export default UIComponent
