/** @module status IDMU's status line */

import { t } from "../../../../i18n/i18n.js"
import { getTheme, themeColors } from "./theme.js"

export { createStatusElement }

/**
 * @param {Document} document
 * @returns {HTMLDivElement}
 */
function createStatusElement(document) {
	const theme = getTheme(document)
	const c = themeColors(theme)
	const statusElement = document.createElement("div")
	statusElement.id = "idmu-status"
	statusElement.textContent = t("ui.ready")
	statusElement.style.minWidth = "160px"
	statusElement.style.maxWidth = "320px"
	statusElement.style.color = c.panelText
	statusElement.style.fontSize = "13px"
	statusElement.style.lineHeight = "1.3"
	return statusElement
}
