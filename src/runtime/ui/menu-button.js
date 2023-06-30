import { applyButtonStyle } from "./style/instagram.js"

export function createMenuButtonElement(text, styleName) {

	const buttonElement = document.createElement("button")
	buttonElement.textContent = text
	applyButtonStyle(buttonElement, styleName)
	return buttonElement
}
