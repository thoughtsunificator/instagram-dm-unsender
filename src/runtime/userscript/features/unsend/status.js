/** @module status IDMU's status line */

import { t } from "../../../../i18n/i18n.js"

export { createStatusElement }

/**
 * @param {Document} document
 * @returns {HTMLDivElement}
 */
function createStatusElement(document) {
	const statusElement = document.createElement("div")
	statusElement.id = "idmu-status"
	statusElement.textContent = t("ui.ready")
	statusElement.style.width = "200px"
	return statusElement
}
