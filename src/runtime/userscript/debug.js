/**
 * @module debug DOM/query debugging helpers for instagram-dm-unsender.
 *
 * Exposed on window.__idmuDebug when the userscript runs. The debug panel
 * in the OSD subscribes to log entries emitted here, so failures can be
 * diagnosed from the UI without opening DevTools.
 */

import { LABEL_PATTERNS, UNSEND_TEXT_VARIANTS } from "../../instagram/messages.js"
import { findActionButton, findUnsendMenuItem } from "../../instagram/message.js"
import { getMessagesInnerContainer, isSentByCurrentUser } from "../../instagram/messages-wrapper.js"

export { DebugLog, installDebugGlobal, snapshotMessageRow, snapshotThread, explainRow, explainScan }

const MAX_ENTRIES = 200

/**
 * Ring buffer of debug entries. Emits "entry" for every new log line.
 *
 * @param {number} [limit]
 */
function DebugLog(limit = MAX_ENTRIES) {
	this.limit = limit
	this.entries = []
	this.listeners = new Set()
}

/**
 * @param {"debug"|"info"|"warn"|"error"} level
 * @param {string} message
 * @param {any}    [data]
 */
DebugLog.prototype.log = function(level, message, data) {
	const entry = {
		at: new Date().toISOString(),
		level,
		message,
		data: data === undefined ? undefined : safeClone(data),
	}
	this.entries.push(entry)
	if(this.entries.length > this.limit) {
		this.entries.shift()
	}
	for(const listener of this.listeners) {
		try {
			listener(entry)
		} catch(error) {
			console.error("DebugLog listener failed", error)
		}
	}
	const prefix = `[idmu:${level}]`
	const fn = console[level] || console.debug
	if(data === undefined) {
		fn(prefix, message)
	} else {
		fn(prefix, message, data)
	}
}

DebugLog.prototype.debug = function(message, data) { this.log("debug", message, data) }
DebugLog.prototype.info = function(message, data) { this.log("info", message, data) }
DebugLog.prototype.warn = function(message, data) { this.log("warn", message, data) }
DebugLog.prototype.error = function(message, data) { this.log("error", message, data) }

DebugLog.prototype.subscribe = function(listener) {
	this.listeners.add(listener)
	return () => this.listeners.delete(listener)
}

DebugLog.prototype.clear = function() {
	this.entries.length = 0
	this.log("info", "Debug log cleared")
}

/**
 * @returns {string}
 */
DebugLog.prototype.formatText = function() {
	return this.entries.map(entry => {
		const data = entry.data === undefined ? "" : ` ${JSON.stringify(entry.data)}`
		return `${entry.at} ${entry.level.toUpperCase()} ${entry.message}${data}`
	}).join("\n")
}

/**
 * @param {any} value
 * @returns {any}
 */
function safeClone(value) {
	try {
		return JSON.parse(JSON.stringify(value))
	} catch {
		return String(value)
	}
}

/**
 * Summarize what the DOM query logic sees for a single message row.
 *
 * @param {Element} root
 * @returns {object}
 */
function snapshotMessageRow(root) {
	const win = root.ownerDocument.defaultView
	const actionButton = findActionButton(root)
	const menuItem = findUnsendMenuItem(root.ownerDocument)
	const rect = root.getBoundingClientRect()
	const styleHints = []
	const queue = [{ element: root, depth: 0 }]
	while(queue.length > 0) {
		const { element, depth } = queue.shift()
		const justify = win.getComputedStyle(element).justifyContent
		if(justify === "flex-end") {
			styleHints.push({ depth, tag: element.tagName.toLowerCase(), justify })
		}
		if(depth < 4) {
			for(const child of element.children) {
				queue.push({ element: child, depth: depth + 1 })
			}
		}
	}
	return {
		tag: root.tagName.toLowerCase(),
		id: root.id || null,
		className: typeof root.className === "string" ? root.className.slice(0, 120) : null,
		childCount: root.children.length,
		textPreview: (root.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
		rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
		isConnected: root.isConnected,
		sentByCurrentUser: isSentByCurrentUser(root, win),
		flexEndHints: styleHints.slice(0, 8),
		actionButton: describeElement(actionButton),
		unsendMenuItemVisible: describeElement(menuItem),
		ariaLabels: collectAriaLabels(root).slice(0, 20),
	}
}

/**
 * Summarize the current thread/message container state for bug reports.
 *
 * @param {object} thread - Thread instance with messagesWrapper.root
 * @returns {object}
 */
function snapshotThread(thread) {
	if(!thread?.messagesWrapper?.root) {
		return { error: "No thread/messagesWrapper available" }
	}
	const root = thread.messagesWrapper.root
	const win = root.ownerDocument.defaultView
	const inner = getMessagesInnerContainer(root)
	const rows = [...inner.children].slice(0, 30).map(child => snapshotMessageRow(child))
	return {
		url: win.location.href,
		userAgent: win.navigator.userAgent,
		scrollTop: root.scrollTop,
		scrollHeight: root.scrollHeight,
		clientHeight: root.clientHeight,
		flexDirection: win.getComputedStyle(root).flexDirection,
		innerChildCount: inner.children.length,
		labelPatterns: LABEL_PATTERNS,
		unsendVariantsCount: UNSEND_TEXT_VARIANTS.length,
		rows,
	}
}

/**
 * @param {Element|null|undefined} element
 * @returns {object|null}
 */
function describeElement(element) {
	if(!element) {
		return null
	}
	const rect = element.getBoundingClientRect?.()
	return {
		tag: element.tagName?.toLowerCase(),
		role: element.getAttribute?.("role") || null,
		ariaLabel: element.getAttribute?.("aria-label") || element.querySelector?.("[aria-label]")?.getAttribute("aria-label") || null,
		text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
		visible: rect ? rect.width > 0 && rect.height > 0 : null,
	}
}

/**
 * @param {Element} root
 * @returns {string[]}
 */
function collectAriaLabels(root) {
	const labels = []
	for(const el of root.querySelectorAll("[aria-label]")) {
		const label = el.getAttribute("aria-label")
		if(label && !labels.includes(label)) {
			labels.push(label)
		}
	}
	return labels
}

/**
 * Explain why a row would or would not be selected/unsent.
 * @param {Element} root
 * @returns {object}
 */
function explainRow(root) {
	const win = root.ownerDocument.defaultView
	const aria = [...root.querySelectorAll("[aria-label]")].map(el => el.getAttribute("aria-label") || "")
	const ownLabel = aria.find(l => /\b(you sent|your message|vous avez envoyé|votre message|tu as envoyé|hai inviato|tu mensaje|enviaste|deine nachricht|du hast gesendet|sua mensagem|você enviou)\b/i.test(l))
	const otherLabel = aria.find(l => /\b(message de |message from |mensaje de |mensagem de |nachricht von )/i.test(l))
	const text = (root.textContent || "").replace(/\s+/g, " ").trim()
	const layoutHits = []
	const q = [{ node: root, depth: 0 }]
	while(q.length) {
		const { node, depth } = q.shift()
		const style = win.getComputedStyle(node)
		if(["flex-end","end"].includes(style.justifyContent)) layoutHits.push({ depth, prop: "justifyContent", value: style.justifyContent })
		if(["flex-end","end"].includes(style.alignSelf)) layoutHits.push({ depth, prop: "alignSelf", value: style.alignSelf })
		if(style.marginLeft === "auto" && style.marginRight !== "auto") layoutHits.push({ depth, prop: "marginLeft", value: "auto" })
		if(depth < 10) for(const child of node.children) q.push({ node: child, depth: depth + 1 })
	}
	const actionButton = findActionButton(root)
	const menuItem = findUnsendMenuItem(root.ownerDocument)
	const sentByCurrentUser = isSentByCurrentUser(root, win)
	const reasons = []
	if(ownLabel) reasons.push({ signal: "own-aria-label", value: ownLabel })
	if(otherLabel) reasons.push({ signal: "other-aria-label", value: otherLabel, blocks: !ownLabel })
	if(/\b(you sent|vous avez envoyé)\b/i.test(text.slice(0,120))) reasons.push({ signal: "own-text" })
	for(const h of layoutHits) reasons.push({ signal: "layout", ...h, blocks: Boolean(otherLabel) && !ownLabel })
	if(reasons.length === 0) reasons.push({ signal: "no-match" })
	return {
		sentByCurrentUser,
		selectedForUnsend: sentByCurrentUser && !root.hasAttribute("data-idmu-ignore") && !root.hasAttribute("data-idmu-unsent"),
		ignored: root.hasAttribute("data-idmu-ignore"),
		unsent: root.hasAttribute("data-idmu-unsent"),
		actionButton: describeElement(actionButton),
		unsendMenuItemVisible: describeElement(menuItem),
		reasons,
		ariaLabels: aria.slice(0, 20),
		textPreview: text.slice(0, 120),
	}
}

function explainScan(thread) {
	if(!thread?.messagesWrapper?.root) return { error: "No thread available" }
	const root = thread.messagesWrapper.root
	const inner = getMessagesInnerContainer(root)
	return [...inner.children].slice(0, 50).map((row, i) => ({ index: i, ...explainRow(row) }))
}

/**
 * Install window.__idmuDebug for manual console debugging.
 *
 * @param {Window} window
 * @param {object} ctx
 * @param {DebugLog} ctx.log
 * @param {() => object|null} ctx.getThread
 * @returns {object}
 */
function installDebugGlobal(window, { log, getThread }) {
	const api = {
		version: 1,
		log,
		getEntries: () => log.entries.slice(),
		formatText: () => log.formatText(),
		clear: () => log.clear(),
		snapshotThread: () => snapshotThread(getThread()),
		snapshotVisibleRows: () => {
			const thread = getThread()
			if(!thread?.messagesWrapper?.root) {
				return { error: "No thread available" }
			}
			const root = thread.messagesWrapper.root
			const inner = getMessagesInnerContainer(root)
			return [...inner.children]
				.filter(el => el.getBoundingClientRect().height > 0)
				.slice(0, 20)
				.map(snapshotMessageRow)
		},
		highlightActionButtons: () => {
			const thread = getThread()
			if(!thread?.messagesWrapper?.root) {
				return 0
			}
			const root = thread.messagesWrapper.root
			const inner = getMessagesInnerContainer(root)
			let count = 0
			for(const row of inner.children) {
				const btn = findActionButton(row)
				if(btn) {
					btn.style.outline = "3px solid #ff00ff"
					btn.style.outlineOffset = "2px"
					count++
				}
			}
			log.info("Highlighted action buttons", { count })
			return count
		},
		probeSelectors: () => {
			const thread = getThread()
			const root = thread?.messagesWrapper?.root
			if(!root) {
				return { error: "No thread available" }
			}
			const inner = getMessagesInnerContainer(root)
			const rows = [...inner.children].slice(0, 10)
			return rows.map((row, index) => {
				const aria = [...row.querySelectorAll("[aria-label]")].map(el => el.getAttribute("aria-label"))
				const hasMenu = Boolean(row.querySelector("[role=button][aria-haspopup='menu'], button[aria-haspopup='menu']"))
				return {
					index,
					sentByCurrentUser: isSentByCurrentUser(row, row.ownerDocument.defaultView),
					actionButton: describeElement(findActionButton(row)),
					hasMenuAriaHaspopup: hasMenu,
					ariaLabels: aria.slice(0, 15),
					text: (row.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
				}
			})
		},
		probeUnsendMenu: () => {
			const item = findUnsendMenuItem(window.document)
			const menus = [...window.document.querySelectorAll("[role=menu], [role=menuitem], [role=dialog]")]
				.map(el => ({ role: el.getAttribute("role"), text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120) }))
			return { found: describeElement(item), menus }
		},
		explainRow: (el) => explainRow(el),
		explainScan: () => explainScan(getThread()),
		help: () => [
			"__idmuDebug.getEntries() - debug log entries",
			"__idmuDebug.formatText() - log as plain text",
			"__idmuDebug.snapshotThread() - thread/container/row snapshot",
			"__idmuDebug.snapshotVisibleRows() - visible rows only",
			"__idmuDebug.highlightActionButtons() - outline detected action buttons",
			"__idmuDebug.probeSelectors() - per-row selector probe for top 10 rows",
			"__idmuDebug.probeUnsendMenu() - inspect currently open menus/dialogs for unsend item",
			"__idmuDebug.explainRow(el) - why a row is/isn't selected for unsend",
			"__idmuDebug.explainScan() - explain selection for top rows",
			"__idmuDebug.clear() - clear debug log",
		].join("\n"),
	}
	window.__idmuDebug = api
	log.info("Debug API installed on window.__idmuDebug", { help: api.help() })
	return api
}
