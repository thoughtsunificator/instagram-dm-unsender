const BUTTON_STYLE = {
	"PRIMARY": "primary",
	"SECONDARY": "secondary",
}

/**
 *
 * @param {HTMLButtonElement} buttonElement
 * @param {string}            styleName
 */
export function applyButtonStyle(buttonElement, styleName=BUTTON_STYLE.PRIMARY) {
	buttonElement.style.zIndex = 9999
	buttonElement.style.fontSize = "var(--system-14-font-size)"
	buttonElement.style.color = "white"
	buttonElement.style.border = "0px"
	buttonElement.style.borderRadius = "8px"
	buttonElement.style.padding = "8px"
	buttonElement.style.fontWeight = "bold"
	buttonElement.style.cursor = "pointer"
	buttonElement.style.lineHeight = "var(--system-14-line-height)"
	buttonElement.style.backgroundColor = `rgb(var(--ig-${styleName}-button))`
}
