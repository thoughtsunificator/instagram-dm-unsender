/** @module alert Alert UI */

/**
 *
 * @param {Document} document
 * @returns {HTMLButtonElement}
 */
export function createAlertsWrapperElement(document) {
	const alertsWrapperElement = document.createElement("div")
	alertsWrapperElement.id = "idmu-alerts"
	alertsWrapperElement.style.position = "fixed"
	alertsWrapperElement.style.top = "20px"
	alertsWrapperElement.style.right = "20px"
	alertsWrapperElement.style.display = "grid"
	return alertsWrapperElement
}

/**
 *
 * @param {Document} document
 * @param {string}   text
 * @returns {HTMLButtonElement}
 */
export function createAlertElement(document, text) {
	const alertElement = document.createElement("div")
	alertElement.textContent = text
	return alertElement
}
