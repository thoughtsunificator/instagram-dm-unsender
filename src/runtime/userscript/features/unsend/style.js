/** @module style Helpers to mimic Instagram's look and feel */

import { applyButtonTheme, getTheme } from "./theme.js"

export { BUTTON_STYLE, applyButtonStyle }

const BUTTON_STYLE = {
	PRIMARY: "primary",
	SECONDARY: "secondary",
}

/**
 * @param {HTMLButtonElement} buttonElement
 * @param {string}            [styleName]
 */
function applyButtonStyle(buttonElement, styleName = BUTTON_STYLE.PRIMARY) {
	const theme = getTheme(buttonElement.ownerDocument)
	const variant = styleName === BUTTON_STYLE.SECONDARY ? "secondary" : "primary"
	applyButtonTheme(buttonElement, theme, variant)
	buttonElement.style.fontSize = "14px"
	buttonElement.style.lineHeight = "1.2"
}
