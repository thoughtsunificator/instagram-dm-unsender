/** @module menu-button Helpers to create buttons that can be used in IDMU's menu */

import { applyButtonStyle } from "./style/instagram.js"

/**
 *
 * @param {Document} document
 * @param {string}   text
 * @param {string}   styleName
 * @returns {HTMLButtonElement}
 */
export function createMenuButtonElement(document, text, styleName) {
	const buttonElement = document.createElement("button")
	buttonElement.textContent = text
	applyButtonStyle(buttonElement, styleName)
	buttonElement.addEventListener("mouseover", () => {
		buttonElement.style.filter = `brightness(1.15)`
	})
	buttonElement.addEventListener("mouseout", () => {
		buttonElement.style.filter = ``
	})
	return buttonElement
}
