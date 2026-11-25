/** @module menu IDMU's main menu */

export { createMenuElement }

/**
 * @param {Document} document
 * @returns {HTMLDivElement}
 */
function createMenuElement(document) {
	const menuElement = document.createElement("div")
	menuElement.id = "idmu-menu"
	menuElement.style.top = "20px"
	menuElement.style.right = "430px"
	menuElement.style.position = "fixed"
	menuElement.style.zIndex = "999"
	menuElement.style.display = "flex"
	menuElement.style.gap = "10px"
	menuElement.style.placeItems = "center"
	return menuElement
}
