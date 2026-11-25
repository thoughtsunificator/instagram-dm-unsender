import { WorkflowElement } from "../workflow/workflow-element.js"
import { sleep } from "../workflow/timing.js"
import { hoverIn, hoverOut } from "./mutations.js"
import { dismissStaleOverlays } from "./overlays.js"
import { UNSEND_TEXT_VARIANTS, LABEL_PATTERNS } from "./messages.js"

export { Message, findActionButton, findUnsendMenuItem, findConfirmUnsendButton, collectHoverTargets, isUnsendText }

const IGNORED_ATTRIBUTE = "data-idmu-ignore"
const UNSENT_ATTRIBUTE = "data-idmu-unsent"

/**
 * A message sent by the current user, as rendered by Instagram.
 *
 * Each step of the unsend workflow is an instance method taking the output of
 * the previous step and an AbortController, so it can be composed with pipe().
 *
 * @param {Element} root
 */
function Message(root) {
	WorkflowElement.call(this, root)
}
Message.prototype = Object.create(WorkflowElement.prototype)
Message.prototype.constructor = Message

/**
 * @param {string|null} text
 * @returns {string}
 */
function normalizeText(text) {
	return (text ?? "").normalize("NFC").replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLocaleLowerCase()
}

/**
 * @param {string|null} text
 * @returns {boolean} true when text is one of the localized "Unsend" labels
 */
function isUnsendText(text) {
	const normalized = normalizeText(text)
	return UNSEND_TEXT_VARIANTS.some(variant => normalized === variant)
}

/**
 * @param {string|null} text
 * @returns {boolean}
 */
function isCancelText(text) {
	const normalized = normalizeText(text)
	return ["cancel", "annuler", "annulla", "abbrechen", "cancelar", "anuluj", "abbrechen", "iptal", "취소", "キャンセル", "取消"]
		.some(label => normalized === label || normalized.includes(label))
}

/**
 * Find the action ("...") button of a message row.
 * Instagram puts the aria-label on a nested SVG/title, so matches are walked up to the nearest button.
 * Falls back to a case-insensitive scan because CSS attribute selectors are case-sensitive.
 *
 * @param {Element} scope
 * @returns {Element|null}
 */
function findActionButton(scope) {
	for(const selector of LABEL_PATTERNS) {
		const element = scope.querySelector(selector)
		if(element) {
			const button = resolveButton(element, scope)
			if(button) {
				return button
			}
		}
	}
	// Case-insensitive aria-label scan: catches localized labels not in LABEL_PATTERNS or case variants.
	const ariaCandidates = scope.querySelectorAll("[aria-label], [aria-haspopup='menu'], [aria-haspopup='true']")
	for(const element of ariaCandidates) {
		const label = (element.getAttribute("aria-label") || "").toLowerCase()
		const hasMenu = element.getAttribute("aria-haspopup") === "menu" || element.getAttribute("aria-haspopup") === "true"
		const looksLikeMore = /more|option|plus|autres|opciones|opzioni|opções|weitere|opti|więcej|meer|daha/.test(label)
		if(!looksLikeMore && !hasMenu) {
			continue
		}
		const button = resolveButton(element, scope)
		if(button) {
			return button
		}
	}
	// Fallback: any role=button/div button with aria-haspopup=menu inside the message row
	return scope.querySelector("[role=button][aria-haspopup='menu'], button[aria-haspopup='menu'], [role=button][aria-haspopup='true']")
}

/**
 * @param {Element} element
 * @param {Element} scope
 * @returns {Element|null}
 */
function resolveButton(element, scope) {
	const button = element.closest("[role=button]") || element.closest("button")
	if(button && scope.contains(button)) {
		return button
	}
	if(element.tagName === "BUTTON" || element.getAttribute("role") === "button") {
		return element
	}
	return null
}

/**
 * Finds the "Unsend" entry of an open actions menu.
 * Prefers menu/menuitem scopes, but also accepts exact text matches elsewhere
 * because Instagram menu markup varies.
 *
 * @param {Document} document
 * @param {Node[]}   [nodes] - Nodes to search first (added by a mutation)
 * @returns {Element|undefined}
 */
function findUnsendMenuItem(document, nodes = []) {
	const seen = new Set()
	const candidates = []
	const pushAll = (root) => {
		if(!root || root.nodeType !== 1) {
			return
		}
		if(root.matches?.("[role=menuitem], [role=menu] [role=button], [role=menu] span, [role=menu] div, [role=dialog] button")) {
			candidates.push(root)
		}
		for(const el of root.querySelectorAll?.("[role=menuitem], [role=menu] span, [role=menu] div, [role=menu] button, [role=menu] [role=button]") || []) {
			candidates.push(el)
		}
	}
	for(const node of nodes) {
		pushAll(node)
	}
	pushAll(document.body)
	for(const element of candidates) {
		if(seen.has(element)) {
			continue
		}
		seen.add(element)
		if(!isUnsendText(element.textContent)) {
			continue
		}
		// Prefer the most clickable element: menuitem/button itself, else a small text node.
		if(element.getAttribute?.("role") === "menuitem" || element.tagName === "BUTTON" || element.getAttribute?.("role") === "button") {
			return element
		}
		if(element.firstChild?.nodeType === 3) {
			return element
		}
		// Accept leaf-ish elements whose normalized text is just the label.
		const directText = normalizeText(element.textContent)
		if(UNSEND_TEXT_VARIANTS.includes(directText)) {
			return element
		}
	}
	return undefined
}

/**
 * Pick the confirmation button in the unsend dialog. Prefer a button whose text
 * matches an unsend label; avoid Cancel/Close; fall back to the last non-cancel button.
 *
 * @param {Document} document
 * @returns {Element|null}
 */
function findConfirmUnsendButton(document) {
	const dialog = document.querySelector("[role=dialog]")
	if(!dialog) {
		return null
	}
	const buttons = [...dialog.querySelectorAll("button, [role=button]")].filter(btn => {
		const rect = btn.getBoundingClientRect?.()
		return !rect || (rect.width > 0 && rect.height > 0)
	})
	const unsendMatch = buttons.find(btn => isUnsendText(btn.textContent))
	if(unsendMatch) {
		return unsendMatch
	}
	const nonCancel = buttons.filter(btn => !isCancelText(btn.textContent))
	if(nonCancel.length > 0) {
		return nonCancel[nonCancel.length - 1]
	}
	return buttons[0] || null
}

/**
 * The message row and its descendants (up to maxDepth): Instagram's React listens for hover at several levels.
 *
 * @param {Element} root
 * @param {number}  [maxDepth=8]
 * @returns {Element[]}
 */
function collectHoverTargets(root, maxDepth = 8) {
	const targets = [root]
	const walk = (element, depth) => {
		if(depth > maxDepth) {
			return
		}
		for(const child of element.children) {
			targets.push(child)
			walk(child, depth + 1)
		}
	}
	walk(root, 0)
	return targets
}

/**
 * Makes the action button appear by hovering the message.
 * Hover is flaky, so it is attempted a few times before falling back to waiting for the button.
 *
 * @param {any}             _ - Unused, output of the previous step
 * @param {AbortController} abortController
 * @returns {Promise<Element>}
 */
function dbg(root, level, message, data) {
	root?.ownerDocument?.defaultView?.__idmuDebug?.log?.[level]?.(message, data)
}

Message.prototype.showActionsMenuButton = async function(_, abortController) {
	const doc = this.root.ownerDocument
	const hoverTargets = collectHoverTargets(this.root)
	dismissStaleOverlays(doc)
	this.root.scrollIntoView?.({ block: "center", inline: "nearest" })
	for(let attempt = 0; attempt < 3; attempt++) {
		hoverTargets.forEach(target => hoverIn(target))
		await sleep(120, abortController.signal)
		const button = findActionButton(this.root)
		if(button) {
			dbg(this.root, "debug", "Action button found", { attempt, aria: button.getAttribute?.("aria-label") || null })
			return button
		}
		const labels = [...this.root.querySelectorAll("[aria-label]")].map(el => el.getAttribute("aria-label")).slice(0, 12)
		console.debug("[idmu] showActionsMenuButton: no button on attempt", attempt, { labels })
		dbg(this.root, "warn", "Action button not found on hover attempt", { attempt, labels, text: (this.root.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80) })
		hoverOut(this.root)
		await sleep(60, abortController.signal)
	}
	hoverTargets.forEach(target => hoverIn(target))
	dbg(this.root, "warn", "Waiting for action button via MutationObserver", { timeoutMs: WorkflowElement.TIMEOUT_MS })
	return this.waitForElement(this.root, () => findActionButton(this.root), abortController)
}

/**
 * Clicks the action button and waits for the "Unsend" menu entry.
 *
 * @param {Element}         actionButton
 * @param {AbortController} abortController
 * @returns {Promise<Element>}
 */
Message.prototype.openActionsMenu = function(actionButton, abortController) {
	const doc = this.root.ownerDocument
	dbg(this.root, "debug", "Clicking action button, waiting for Unsend menu item")
	return this.clickElementAndWaitFor(actionButton, doc.body, (mutations) => {
		const nodes = mutations ? mutations.flatMap(mutation => [...mutation.addedNodes]) : []
		const item = findUnsendMenuItem(doc, nodes)
		if(item) {
			dbg(this.root, "debug", "Unsend menu item found", { text: (item.textContent || "").trim().slice(0, 40) })
		}
		return item
	}, abortController)
}

/**
 * Clicks "Unsend" and waits for the confirmation dialog.
 *
 * @param {Element}         unsendButton
 * @param {AbortController} abortController
 * @returns {Promise<Element>}
 */
Message.prototype.openConfirmUnsendModal = function(unsendButton, abortController) {
	const doc = this.root.ownerDocument
	dbg(this.root, "debug", "Clicking Unsend menu item, waiting for confirmation dialog")
	return this.clickElementAndWaitFor(unsendButton, doc.body, () => {
		const btn = findConfirmUnsendButton(doc) || doc.querySelector("[role=dialog] button")
		if(btn) {
			dbg(this.root, "debug", "Confirm dialog button found", { text: (btn.textContent || "").trim().slice(0, 40) })
		}
		return btn
	}, abortController)
}

/**
 * Clicks the confirm button and waits for the dialog to close.
 *
 * @param {Element}         dialogButton
 * @param {AbortController} abortController
 * @returns {Promise<boolean>}
 */
Message.prototype.confirmUnsend = function(dialogButton, abortController) {
	const doc = this.root.ownerDocument
	const dialog = dialogButton.closest?.("[role=dialog]") || doc.querySelector("[role=dialog]")
	const confirmButton = dialog ? (findConfirmUnsendButton(doc) || dialogButton) : dialogButton
	dbg(this.root, "debug", "Clicking confirm unsend button", { text: (confirmButton.textContent || "").trim().slice(0, 40) })
	return this.clickElementAndWaitFor(confirmButton, doc.body, () => doc.querySelector("[role=dialog]") === null, abortController, 5000)
}

/**
 * @returns {boolean} true while the message is still rendered
 */
Message.prototype.exists = function() {
	return this.root.isConnected
}

Message.prototype.isUnsent = function() {
	return this.root.hasAttribute(UNSENT_ATTRIBUTE)
}

Message.prototype.markUnsent = function() {
	this.root.setAttribute(UNSENT_ATTRIBUTE, "")
}

/**
 * Prevents the message from being picked again during the current scan
 */
Message.prototype.markIgnored = function() {
	this.root.setAttribute(IGNORED_ATTRIBUTE, "")
}

/**
 * Lets a failed message be picked again
 */
Message.prototype.clearIgnored = function() {
	this.root.removeAttribute(IGNORED_ATTRIBUTE)
}
