/** @module osd IDMU's on-screen display: menu, button, status and the overlay blocking the page while unsending */

import { UnsendButton } from "./unsend-button.js"
import { createMenuElement } from "./menu.js"
import { createOverlayElement } from "./overlay.js"
import { createStatusElement } from "./status.js"

export { OSD }

/**
 * @param {Document} document
 * @param {object}   handlers
 * @param {function} handlers.onToggle - Called when the user clicks the main button
 */
function OSD(document, { onToggle }) {
	this.document = document
	this.root = document.createElement("div")
	this.root.id = "idmu-root"
	this.menuElement = createMenuElement(document)
	this.overlayElement = createOverlayElement(document)
	this.statusElement = createStatusElement(document)
	this.button = new UnsendButton(document)
	this.button.on("toggle", onToggle)
	this.menuElement.append(this.button.root, this.statusElement)
	this.root.append(this.menuElement)
}

OSD.prototype.render = function() {
	this.document.body.append(this.root, this.overlayElement)
}

OSD.prototype.remove = function() {
	this.root.remove()
	this.overlayElement.remove()
}

/**
 * @param {string} text
 */
OSD.prototype.setStatus = function(text) {
	this.statusElement.textContent = text
}

/**
 * Disables the rest of the UI while unsending
 *
 * @param {boolean} running
 */
OSD.prototype.setRunning = function(running) {
	this.overlayElement.style.display = running ? "" : "none"
	if(running) {
		this.overlayElement.focus()
	}
	this.button.setRunning(running)
	this.statusElement.style.color = running ? "white" : ""
}

OSD.prototype.focusOverlay = function() {
	this.overlayElement.focus()
}
