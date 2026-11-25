/** @module unsend-button The "Unsend all DMs" button. It only emits intents, the feature decides what to do */

import { Observable } from "../../../../event/observable.js"
import { BUTTON_STYLE, applyButtonStyle } from "./style.js"
import { getTheme, themeColors } from "./theme.js"
import { t } from "../../../../i18n/i18n.js"

export { UnsendButton }

/**
 * Emits "toggle" when clicked
 *
 * @param {Document} document
 */
function UnsendButton(document) {
	Observable.call(this)
	this.root = document.createElement("button")
	this.root.textContent = t("ui.unsendAll")
	applyButtonStyle(this.root, BUTTON_STYLE.PRIMARY)
	this.root.addEventListener("mouseover", () => { this.root.style.filter = "brightness(1.08)" })
	this.root.addEventListener("mouseout", () => { this.root.style.filter = "" })
	this.root.addEventListener("click", () => this.emit("toggle"))
}
UnsendButton.prototype = Object.create(Observable.prototype)
UnsendButton.prototype.constructor = UnsendButton

/**
 * @param {boolean} running
 */
UnsendButton.prototype.setRunning = function(running) {
	const theme = getTheme(this.root.ownerDocument)
	const c = themeColors(theme)
	this.root.textContent = running ? t("ui.stopProcessing") : t("ui.unsendAll")
	this.root.style.background = running ? c.dangerBg : c.buttonBg
	this.root.style.color = c.buttonText
	this.root.style.border = "0"
}
