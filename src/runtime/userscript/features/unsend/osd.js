/** @module osd IDMU's on-screen display: menu, button, status and the overlay blocking the page while unsending */

import { UnsendButton } from "./unsend-button.js"
import { createMenuElement } from "./menu.js"
import { createOverlayElement } from "./overlay.js"
import { createStatusElement } from "./status.js"
import { createChangelogPanel } from "./changelog-panel.js"
import { BUTTON_STYLE, applyButtonStyle } from "./style.js"
import { CHANGELOG } from "../../changelog.js"
import { t } from "../../../../i18n/i18n.js"
import { applyPanelStyle, getTheme, themeColors } from "./theme.js"

export { OSD }

/**
 * @param {Document} document
 * @param {object}   handlers
 * @param {function} handlers.onToggle - Called when the user clicks the main button
 * @param {import("../../debug.js").DebugLog} [handlers.debugLog]
 * @param {function(): string} [handlers.getDebugReport]
 * @param {function(): object} [handlers.onSnapshot]
 */
function OSD(document, { onToggle, debugLog = null, getDebugReport = null, onSnapshot = null }) {
	this.document = document
	this.debugLog = debugLog
	this.getDebugReport = getDebugReport
	this.onSnapshot = onSnapshot
	this.root = document.createElement("div")
	this.root.id = "idmu-root"
	this.menuElement = createMenuElement(document)
	this.overlayElement = createOverlayElement(document)
	this.statusElement = createStatusElement(document)
	this.progressElement = document.createElement("div")
	this.progressElement.id = "idmu-progress"
	this.progressElement.style.fontSize = "12px"
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

	this.debugButton = document.createElement("button")
	this.debugButton.id = "idmu-debug-toggle"
	this.debugButton.textContent = t("ui.debug")
	applyButtonStyle(this.debugButton, BUTTON_STYLE.SECONDARY)
	this.debugButton.addEventListener("click", () => this.toggleDebugPanel())

	this.debugPanel = createDebugPanel(document, {
		onCopy: () => this.copyDebugReport(),
		onSnapshot: () => this.runSnapshot(),
		onClear: () => this.debugLog?.clear(),
	})
	this.debugPanel.root.style.display = "none"

	const infoElement = document.createElement("div")
	infoElement.id = "idmu-info"
	infoElement.style.minWidth = "220px"
	infoElement.append(this.statusElement, this.progressElement)
	this.menuElement.append(this.button.root, infoElement, this.whatsNewButton, this.debugButton)
	this.root.append(this.menuElement, this.changelog.root, this.debugPanel.root)
	this.setProgress({ unsent: 0, failures: 0 })

	this.debugUnsubscribe = null
	if(this.debugLog) {
		this.debugUnsubscribe = this.debugLog.subscribe(entry => this.appendDebugEntry(entry))
		this.debugLog.entries.forEach(entry => this.appendDebugEntry(entry))
	}
}

OSD.prototype.render = function() {
	this.document.body.append(this.root, this.overlayElement)
}

OSD.prototype.remove = function() {
	this.debugUnsubscribe?.()
	this.root.remove()
	this.overlayElement.remove()
}

OSD.prototype.setStatus = function(text) {
	this.statusElement.textContent = text
}

OSD.prototype.setProgress = function({ unsent, failures }) {
	this.progressElement.textContent = t("ui.progress", { unsent, failures })
}

OSD.prototype.setRunning = function(running) {
	this.overlayElement.style.display = running ? "" : "none"
	if(running) this.overlayElement.focus()
	this.button.setRunning(running)
	const c = themeColors(getTheme(this.document))
	this.statusElement.style.color = c.panelText
	this.progressElement.style.color = c.mutedText
}

OSD.prototype.focusOverlay = function() {
	this.overlayElement.focus()
}

OSD.prototype.toggleDebugPanel = function() {
	this.debugPanel.root.style.display = this.debugPanel.root.style.display === "none" ? "" : "none"
}

OSD.prototype.appendDebugEntry = function(entry) {
	if(this.debugPanel.logElement.childElementCount === 0 || this.debugPanel.logElement.textContent === t("ui.debugEmpty")) {
		this.debugPanel.logElement.textContent = ""
	}
	if(entry.message === "Debug log cleared" && this.debugLog?.entries.length === 1) {
		this.debugPanel.logElement.textContent = ""
	}
	const c = themeColors(getTheme(this.document))
	const line = this.document.createElement("div")
	line.style.padding = "2px 0"
	line.style.borderBottom = `1px solid ${c.panelBorder}`
	line.style.whiteSpace = "pre-wrap"
	line.style.wordBreak = "break-word"
	const time = (entry.at || "").slice(11, 19)
	const data = entry.data === undefined ? "" : ` ${JSON.stringify(entry.data)}`
	line.textContent = `[${time}] ${entry.level.toUpperCase()} ${entry.message}${data}`
	if(entry.level === "error") line.style.color = "#d93025"
	if(entry.level === "warn") line.style.color = "#b26a00"
	this.debugPanel.logElement.append(line)
	while(this.debugPanel.logElement.childElementCount > 150) {
		this.debugPanel.logElement.firstChild.remove()
	}
	this.debugPanel.logElement.scrollTop = this.debugPanel.logElement.scrollHeight
}

OSD.prototype.copyDebugReport = async function() {
	const text = this.getDebugReport ? this.getDebugReport() : (this.debugLog?.formatText() || "")
	try {
		await this.document.defaultView.navigator.clipboard.writeText(text)
		this.setStatus(t("ui.debugCopied"))
	} catch(error) {
		console.error(error)
		const ta = this.document.createElement("textarea")
		ta.value = text
		ta.style.position = "fixed"
		ta.style.opacity = "0"
		this.document.body.append(ta)
		ta.select()
		const ok = this.document.execCommand?.("copy")
		ta.remove()
		this.setStatus(ok ? t("ui.debugCopied") : t("ui.debugCopyFailed"))
	}
}

OSD.prototype.runSnapshot = function() {
	if(!this.onSnapshot) return
	const snapshot = this.onSnapshot()
	this.debugLog?.info("DOM snapshot", snapshot)
	this.toggleDebugPanel()
	if(this.debugPanel.root.style.display === "none") this.toggleDebugPanel()
}

function createDebugPanel(document, { onCopy, onSnapshot, onClear }) {
	const theme = getTheme(document)
	const c = themeColors(theme)
	const root = document.createElement("div")
	root.id = "idmu-debug-panel"
	root.style.position = "fixed"
	root.style.top = "108px"
	root.style.right = "16px"
	root.style.zIndex = "999"
	root.style.width = "min(560px, calc(100vw - 32px))"
	root.style.maxHeight = "50vh"
	root.style.display = "flex"
	root.style.flexDirection = "column"
	root.style.padding = "12px"
	root.style.borderRadius = "14px"
	root.style.fontSize = "12px"
	applyPanelStyle(root, theme)

	const header = document.createElement("div")
	header.style.display = "flex"
	header.style.gap = "8px"
	header.style.alignItems = "center"
	header.style.marginBottom = "8px"
	header.style.flexWrap = "wrap"
	const title = document.createElement("strong")
	title.textContent = t("ui.debug")
	title.style.marginRight = "auto"
	const snapBtn = document.createElement("button")
	snapBtn.textContent = t("ui.debugSnapshot")
	applyButtonStyle(snapBtn, BUTTON_STYLE.SECONDARY)
	snapBtn.addEventListener("click", onSnapshot)
	const copyBtn = document.createElement("button")
	copyBtn.textContent = t("ui.copyDebug")
	applyButtonStyle(copyBtn, BUTTON_STYLE.SECONDARY)
	copyBtn.addEventListener("click", onCopy)
	const clearBtn = document.createElement("button")
	clearBtn.textContent = t("ui.debugClear")
	applyButtonStyle(clearBtn, BUTTON_STYLE.SECONDARY)
	clearBtn.addEventListener("click", onClear)
	header.append(title, snapBtn, copyBtn, clearBtn)

	const logElement = document.createElement("div")
	logElement.id = "idmu-debug-log"
	logElement.style.overflow = "auto"
	logElement.style.maxHeight = "40vh"
	logElement.style.fontFamily = "monospace"
	logElement.style.fontSize = "11px"
	logElement.style.lineHeight = "1.35"
	logElement.style.padding = "4px 0"
	logElement.style.background = c.logBg
	logElement.style.borderRadius = "8px"
	logElement.textContent = t("ui.debugEmpty")

	root.append(header, logElement)
	return { root, logElement }
}
