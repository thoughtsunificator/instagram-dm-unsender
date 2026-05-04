import { WorkflowElement } from "../workflow/workflow-element.js"
import { dispatchHoverOut, dispatchHoverIn } from "./dom-events.js"
import * as messages from "./messages.js"

export { Message }

function Message(root, page) {
	WorkflowElement.prototype.constructor.call(this, root, page)
}
Message.prototype = Object.create(WorkflowElement)
Message.prototype.constructor = Message

/**
 * Find the action button within the message row.
 * Instagram moved aria-label from the button div to a nested SVG/title.
 * Any match (SVG or div) is walked up to the nearest [role=button] ancestor.
 *
 * @param {Element} scope
 * @returns {Element|null}
 */
function findActionButton(scope) {
	for (const sel of messages.LABEL_PATTERNS) {
		const el = scope.querySelector(sel)
		if (el) {
			// Always resolve to a clickable button container
			const btn = el.closest("[role=button]") || el.closest("button")
			if (btn && scope.contains(btn)) {
				return btn
			}
			// el itself is already a button-like element
			if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") {
				return el
			}
		}
	}
	// Fallback: any role=button with aria-haspopup=menu inside the message row
	return scope.querySelector("[role=button][aria-haspopup=menu]")
}

/**
 * @param {AbortController} abortController
 * @returns {Promise<HTMLButtonElement>}
 */
Message.prototype.showActionsMenuButton = async function(abortController) {
	console.debug("Workflow step 1 : showActionsMenuButton", this.root)
	// Collect all hoverable ancestors from root down to the message bubble.
	// Instagram React listens at intermediate levels (role=group, flex-end wrapper).
	const hoverTargets = [this.root]
	const collectTargets = (el, depth) => {
		if (depth > 8) return
		for (const child of el.children) {
			hoverTargets.push(child)
			collectTargets(child, depth + 1)
		}
	}
	collectTargets(this.root, 0)

	// Try up to 3 times — hover events can be flaky
	for (let attempt = 0; attempt < 3; attempt++) {
		for (const target of hoverTargets) {
			dispatchHoverIn(target)
		}
		console.debug("Workflow step 1 : attempt", attempt, "no button found, retrying...")
		dispatchHoverOut(this.root)
		await new Promise(resolve => setTimeout(resolve, 50))
	}

	for (const target of hoverTargets) {
		dispatchHoverIn(target)
	}

	try {
		const actionButton = await Promise.race([
			this.waitForElement(
				this.root,
				() => findActionButton(this.root),
				waitAbortController
			),
			new Promise((resolve, reject) => {
				promiseTimeout = setTimeout(() => reject("Timeout showActionsMenuButton"), 3000)
			})
		])

		if (actionButton) {
			return actionButton
		}
		return actionButton
	} finally {
		waitAbortController.abort() // Aborting without reason because the reason is the error itself
		clearTimeout(promiseTimeout)
		abortController.signal.removeEventListener("abort", abortHandler)
	}
}

/**
 * @param {AbortController} abortController
 * @returns {Promise<boolean>}
 */
Message.prototype.hideActionMenuButton = async function(abortController) {
	console.debug("hideActionMenuButton", this.root)
	dispatchHoverOut(this.root)

	const noneEl = this.root.querySelector("[role=none]")
	if (noneEl) {
		dispatchHoverOut(noneEl)
	}

	try {
		const result = await Promise.race([
			this.waitForElement(
				this.root,
				() => this._findActionButton(this.root) === null,
				waitAbortController
			),
			new Promise((resolve, reject) => {
				resolveTimeout = resolve
				promiseTimeout = setTimeout(() => reject("Timeout hideActionMenuButton"), 500)
			})
		])
		return result
	} finally {
		waitAbortController.abort() // Aborting without reason because the reason is the error itself
		clearTimeout(promiseTimeout)
		abortController.signal.removeEventListener("abort", abortHandler)
	}
}

/**
 * Opens the actions menu by clicking the action button and waiting for the "Unsend" item.
 *
 * @param {HTMLButtonElement} actionButton
 * @param {AbortController} abortController
 * @returns {Promise}
 */
Unsend.prototype.openActionsMenu = async function(actionButton, abortController) {
	console.debug("Workflow step 2 : Clicking actionButton and waiting for unsend menu item to appear", actionButton)

	const isUnsendText = (text) => {
		const normalized = text.trim().toLocaleLowerCase()
		return messages.UNSEND_TEXT_VARIANTS.some(v => normalized === v)
	}

	try {
		const unsendButton = await Promise.race([
			this.clickElementAndWaitFor(
				actionButton,
				this.root.ownerDocument.body,
				(mutations) => {
					if (mutations) {
						const addedNodes = [...mutations.map(mutation => [...mutation.addedNodes])].flat().filter(node => node.nodeType === 1)
						for (const addedNode of addedNodes) {
							const node = [...addedNode.querySelectorAll("span,div")].find(node => isUnsendText(node.textContent) && node.firstChild?.nodeType === 3)
							if (node) {
								console.debug("Workflow step 2 : found unsend node via mutation", node)
								return node
							}
						}
					}
					// Fallback: scan the whole document for an unsend menu item already present
					const allSpans = this.root.ownerDocument.querySelectorAll("[role=menu] span, [role=menu] div, [role=menuitem] span, [role=menuitem] div")
					for (const span of allSpans) {
						if (isUnsendText(span.textContent) && span.firstChild?.nodeType === 3) {
							console.debug("Workflow step 2 : found unsend node via document scan", span)
							return span
						}
					}
				},
				waitAbortController
			),
			new Promise((resolve, reject) => {
				promiseTimeout = setTimeout(() => reject("Timeout openActionsMenu"), 3000)
			})
		])

		console.debug("Workflow step 2 : Found unsendButton", unsendButton)
		return unsendButton
	} finally {
		waitAbortController.abort() // Aborting without reason because the reason is the error itself
		clearTimeout(promiseTimeout)
		abortController.signal.removeEventListener("abort", abortHandler)
	}
}

/**
 * Closes the actions menu.
 *
 * @param {HTMLButtonElement} actionButton
 * @param {HTMLDivElement} actionsMenuElement
 * @param {AbortController} abortController
 * @returns {Promise<boolean>}
 */
Message.prototype.closeActionsMenu = async function(actionButton, actionsMenuElement) {
	console.debug("closeActionsMenu")
	try {
		this.withTimeout(
			this.clickElementAndWaitFor(
				actionButton,
				this.root.ownerDocument.body,
				() => this.root.ownerDocument.body.contains(actionsMenuElement) === false
			),
		)
		return result !== null
	} catch(error) {
		console.error(error)
	}
}

/**
 * Click unsend button and wait for the confirmation dialog.
 *
 * @param {HTMLSpanElement} unsendButton
 * @param {AbortController} abortController
 * @returns {Promise<HTMLButtonElement>|Promise<Error>}
 */
Message.prototype.openConfirmUnsendModal = function(unsendButton, abortController) {
	console.debug("Workflow step 3 : Clicking unsendButton and waiting for dialog to appear...")
	return this.clickElementAndWaitFor(
		unsendButton,
		this.root.ownerDocument.body,
		() => this.root.ownerDocument.querySelector("[role=dialog] button"),
		abortController
	)
}

/**
 * Click unsend confirm button in the modal dialog.
 *
 * @param {HTMLButtonElement} dialogButton
 * @param {AbortController} abortController
 * @returns {Promise}
 */
Message.prototype.confirmUnsend = async function(dialogButton, abortController) {
	console.debug("Workflow final step : confirmUnsend", dialogButton)
	await this.clickElementAndWaitFor(
		dialogButton,
		this.root.ownerDocument.body,
		() => this.root.ownerDocument.querySelector("[role=dialog] button") === null,
		abortController
	)
}

/**
 * Used to determine whether the message is still present in the DOM
 * If it is that means the unsending somehow fails
 */
Message.prototype.exists = function() {
	return this.root.isConnected && !this.root.hasAttribute("data-idmu-unsent")
}

Message.prototype.setFlag = function() {
	if(flag === "unsent") {
		this.uiComponent.root.setAttribute("data-idmu-unsent", "") // Next run should ignore this message
	} else if(flag === "ignore") {
		this.uiComponent.root.setAttribute("data-idmu-ignore", "") // Next run should ignore this message
	}
}

