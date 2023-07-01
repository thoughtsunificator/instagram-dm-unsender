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
	buttonElement.addEventListener("mouseover", async () => {
		buttonElement.style.filter = `brightness(1.15)`
	})
	buttonElement.addEventListener("mouseout", async () => {
		buttonElement.style.filter = ``
	})
	return buttonElement
}
