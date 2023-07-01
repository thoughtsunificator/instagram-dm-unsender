import { clickElement } from "../dom/click-element.js"
import { waitForElement } from "../dom/wait-for-element.js"

export default class UIComponent {
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
	async waitForElement(target, getElement) {
		return getElement() || waitForElement(target, getElement)
	}

	/**
	 *
	 * @param {Element} clickTarget
	 * @param {Element} target
	 * @param {function} getElement
	 * @returns {Promise<Element>}
	 */
	async clickElement(clickTarget, target, getElement) {
		return clickElement(clickTarget, target, getElement)
	}

}
