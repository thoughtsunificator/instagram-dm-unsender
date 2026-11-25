import { WorkflowElement } from "../workflow/workflow-element.js"
import { sleep } from "../workflow/timing.js"
import { hoverIn, hoverOut } from "./mutations.js"
import { dismissStaleOverlays } from "./overlays.js"
import { UNSEND_TEXT_VARIANTS, LABEL_PATTERNS } from "./messages.js"

export { Message, findActionButton, findUnsendMenuItem, collectHoverTargets }

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
 * Find the action ("...") button of a message row.
 * Instagram puts the aria-label on a nested SVG/title, so matches are walked up to the nearest button.
 *
 * @param {Element} scope
 * @returns {Element|null}
 */
function findActionButton(scope) {
	for(const selector of LABEL_PATTERNS) {
		const element = scope.querySelector(selector)
		if(element) {
			const button = element.closest("[role=button]") || element.closest("button")
			if(button && scope.contains(button)) {
				return button
			}
			if(element.tagName === "BUTTON" || element.getAttribute("role") === "button") {
				return element
			}
		}
	}
	// Fallback: any role=button with aria-haspopup=menu inside the message row
	return scope.querySelector("[role=button][aria-haspopup=menu]")
}

/**
 * @param {string|null} text
 * @returns {boolean} true when text is one of the localized "Unsend" labels
 */
function isUnsendText(text) {
	const normalized = (text ?? "").trim().toLocaleLowerCase()
	return UNSEND_TEXT_VARIANTS.some(variant => normalized === variant)
}

/**
 * Finds the "Unsend" entry of an open actions menu
 *
 * @param {Document} document
 * @param {Node[]}   [nodes] - Nodes to search first (added by a mutation)
 * @returns {Element|undefined}
 */
function findUnsendMenuItem(document, nodes = []) {
	for(const node of nodes) {
		if(node.nodeType !== 1) {
			continue
		}
		const candidate = [...node.querySelectorAll("span,div")].find(element => isUnsendText(element.textContent) && element.firstChild?.nodeType === 3)
		if(candidate) {
			return candidate
		}
	}
	return [...document.querySelectorAll("[role=menu] span, [role=menu] div, [role=menuitem] span, [role=menuitem] div")]
		.find(element => isUnsendText(element.textContent) && element.firstChild?.nodeType === 3)
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
Message.prototype.showActionsMenuButton = async function(_, abortController) {
	const doc = this.root.ownerDocument
	const hoverTargets = collectHoverTargets(this.root)
	dismissStaleOverlays(doc)
	for(let attempt = 0; attempt < 3; attempt++) {
		hoverTargets.forEach(target => hoverIn(target))
		await sleep(100, abortController.signal)
		const button = findActionButton(this.root)
		if(button) {
			return button
		}
		console.debug("showActionsMenuButton: no button on attempt", attempt)
		hoverOut(this.root)
		await sleep(50, abortController.signal)
	}
	hoverTargets.forEach(target => hoverIn(target))
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
	return this.clickElementAndWaitFor(actionButton, doc.body, (mutations) => {
		const nodes = mutations ? mutations.flatMap(mutation => [...mutation.addedNodes]) : []
		return findUnsendMenuItem(doc, nodes)
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
	return this.clickElementAndWaitFor(unsendButton, doc.body, () => doc.querySelector("[role=dialog] button"), abortController)
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
	return this.clickElementAndWaitFor(dialogButton, doc.body, () => doc.querySelector("[role=dialog] button") === null, abortController, 5000)
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
