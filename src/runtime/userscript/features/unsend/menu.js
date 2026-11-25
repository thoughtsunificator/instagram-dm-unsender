/** @module menu IDMU's main menu */

import { applyPanelStyle, getTheme } from "./theme.js"

export { createMenuElement }

/**
 * @param {Document} document
 * @returns {HTMLDivElement}
 */
function createMenuElement(document) {
	const menuElement = document.createElement("div")
	menuElement.id = "idmu-menu"
	menuElement.style.top = "16px"
	menuElement.style.right = "16px"
	menuElement.style.position = "fixed"
	menuElement.style.zIndex = "999"
	menuElement.style.display = "flex"
	menuElement.style.gap = "8px"
	menuElement.style.alignItems = "center"
	menuElement.style.flexWrap = "wrap"
	menuElement.style.maxWidth = "min(720px, calc(100vw - 32px))"
	menuElement.style.padding = "10px 12px"
	menuElement.style.borderRadius = "14px"
	applyPanelStyle(menuElement, getTheme(document))
	return menuElement
}
