/** @module overlay IDMU's overlay */

/**
 * @param {Document} document
 * @returns {HTMLDivElement}
 */
export function createOverlayElement(document) {
	const overlayElement = document.createElement("div")
	overlayElement.id = "idmu-overlay"
	overlayElement.tabIndex = 0
	overlayElement.style.top = "0"
	overlayElement.style.right = "0"
	overlayElement.style.position = "fixed"
	overlayElement.style.width = "100vw"
	overlayElement.style.height = "100vh"
	overlayElement.style.zIndex = "998"
	overlayElement.style.backgroundColor = "#000000d6"
	overlayElement.style.display = "none"
	return overlayElement
}
