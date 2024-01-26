/** @module ui-component Base class for any element that is a part of the UI. */

import { waitForElement, clickElementAndWaitFor } from "../dom/async-events.js"

export class UIComponent {
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
	 * @returns {Promise<Element>}
	 */
	waitForElement(target, getElement) {
		return getElement() || waitForElement(target, getElement)
	}

	/**
	 *
	 * @param {Element} clickTarget
	 * @param {Element} target
	 * @param {function} getElement
	 * @returns {Promise<Element>}
	 */
	clickElementAndWaitFor(clickTarget, target, getElement) {
		return clickElementAndWaitFor(clickTarget, target, getElement)
	}

}

export default UIComponent
