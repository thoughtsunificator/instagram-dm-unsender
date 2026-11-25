/** @module status IDMU's status line */

export { createStatusElement }

/**
 * @param {Document} document
 * @returns {HTMLDivElement}
 */
function createStatusElement(document) {
	const statusElement = document.createElement("div")
	statusElement.id = "idmu-status"
	statusElement.textContent = "Ready"
	statusElement.style.width = "200px"
	return statusElement
}
