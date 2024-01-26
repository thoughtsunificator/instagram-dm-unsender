/** @module menu IDMU's main menu */

/**
 * @param {Document} document
 * @returns {HTMLButtonElement}
 */
export function createMenuElement(document) {
	const menuElement = document.createElement("div")
	menuElement.style.top = "20px"
	menuElement.style.right = "430px"
	menuElement.style.position = "fixed"
	menuElement.style.zIndex = 999
	menuElement.style.display = "flex"
	menuElement.style.gap = "10px"
	return menuElement
}
