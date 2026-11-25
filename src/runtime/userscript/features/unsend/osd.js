/** @module osd IDMU's on-screen display: menu, button, status and the overlay blocking the page while unsending */

import { UnsendButton } from "./unsend-button.js"
import { createMenuElement } from "./menu.js"
import { createOverlayElement } from "./overlay.js"
import { createStatusElement } from "./status.js"
import { createChangelogPanel } from "./changelog-panel.js"
import { BUTTON_STYLE, applyButtonStyle } from "./style.js"
import { CHANGELOG } from "../../changelog.js"
import { t } from "../../../../i18n/i18n.js"

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
	this.progressElement = document.createElement("div")
	this.progressElement.id = "idmu-progress"
	this.progressElement.style.fontSize = "var(--system-12-font-size, 12px)"
	this.progressElement.style.opacity = "0.8"
	this.progressElement.style.whiteSpace = "nowrap"
	this.button = new UnsendButton(document)
	this.button.on("toggle", onToggle)
	this.changelog = createChangelogPanel(document, CHANGELOG)
	this.whatsNewButton = document.createElement("button")
	this.whatsNewButton.id = "idmu-whats-new"
	this.whatsNewButton.textContent = t("ui.whatsNew")
	applyButtonStyle(this.whatsNewButton, BUTTON_STYLE.SECONDARY)
	this.whatsNewButton.addEventListener("click", () => this.changelog.toggle())
	const infoElement = document.createElement("div")
	infoElement.append(this.statusElement, this.progressElement)
	this.menuElement.append(this.button.root, infoElement, this.whatsNewButton)
	this.root.append(this.menuElement, this.changelog.root)
	this.setProgress({ unsent: 0, failures: 0 })
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
 * Counts of the current run, shown under the status line
 *
 * @param {{ unsent: number, failures: number }} counts
 */
OSD.prototype.setProgress = function({ unsent, failures }) {
	this.progressElement.textContent = t("ui.progress", { unsent, failures })
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
	this.progressElement.style.color = running ? "white" : ""
}

OSD.prototype.focusOverlay = function() {
	this.overlayElement.focus()
}
