/** @module unsend-button The "Unsend all DMs" button. It only emits intents, the feature decides what to do */

import { Observable } from "../../../../event/observable.js"
import { BUTTON_STYLE, applyButtonStyle } from "./style.js"

export { UnsendButton }

const IDLE_TEXT = "Unsend all DMs"
const RUNNING_TEXT = "Stop processing"
const RUNNING_COLOR = "#FA383E"

/**
 * Emits "toggle" when clicked
 *
 * @param {Document} document
 */
function UnsendButton(document) {
	Observable.call(this)
	this.root = document.createElement("button")
	this.root.textContent = IDLE_TEXT
	applyButtonStyle(this.root, BUTTON_STYLE.PRIMARY)
	this.idleColor = this.root.style.backgroundColor
	this.root.addEventListener("mouseover", () => {
		this.root.style.filter = "brightness(1.15)"
	})
	this.root.addEventListener("mouseout", () => {
		this.root.style.filter = ""
	})
	this.root.addEventListener("click", () => this.emit("toggle"))
}
UnsendButton.prototype = Object.create(Observable.prototype)
UnsendButton.prototype.constructor = UnsendButton

/**
 * @param {boolean} running
 */
UnsendButton.prototype.setRunning = function(running) {
	this.root.textContent = running ? RUNNING_TEXT : IDLE_TEXT
	this.root.style.backgroundColor = running ? RUNNING_COLOR : this.idleColor
}
