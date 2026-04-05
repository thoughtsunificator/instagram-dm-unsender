/** @module ui-message UI element representing a message */

import UIComponent from "../ui-component.js"

import * as strings from "./strings.js"

/**
 * Dispatches pointer and mouse hover events on a target element.
 * Instagram's React uses pointer events internally; mouse events alone are insufficient.
 *
 * @param {Element} target
 */
function dispatchHoverIn(target) {
	const rect = target.getBoundingClientRect()
	const opts = {
		bubbles: true,
		cancelable: true,
		clientX: rect.x + rect.width / 2,
		clientY: rect.y + rect.height / 2,
		pointerId: 1,
		pointerType: "mouse",
	}
	target.dispatchEvent(new PointerEvent("pointerenter", { ...opts, bubbles: false }))
	target.dispatchEvent(new PointerEvent("pointerover", opts))
	target.dispatchEvent(new PointerEvent("pointermove", opts))
	target.dispatchEvent(new MouseEvent("mouseenter", { ...opts, bubbles: false }))
	target.dispatchEvent(new MouseEvent("mouseover", opts))
	target.dispatchEvent(new MouseEvent("mousemove", opts))
}

/**
 * Dispatches pointer and mouse leave events on a target element.
 *
 * @param {Element} target
 */
function dispatchHoverOut(target) {
	const rect = target.getBoundingClientRect()
	const opts = {
		bubbles: true,
		cancelable: true,
		clientX: rect.x + rect.width / 2,
		clientY: rect.y + rect.height / 2,
		pointerId: 1,
		pointerType: "mouse",
	}
	target.dispatchEvent(new PointerEvent("pointerout", opts))
	target.dispatchEvent(new PointerEvent("pointerleave", { ...opts, bubbles: false }))
	target.dispatchEvent(new MouseEvent("mouseout", opts))
	target.dispatchEvent(new MouseEvent("mouseleave", { ...opts, bubbles: false }))
}

class UIMessage extends UIComponent {

	/**
	 * Dismiss any stale dialog or dropdown left from a previous failed workflow.
	 */
	_dismissStaleOverlays() {
		const doc = this.root.ownerDocument
		// Close stale confirmation dialogs
		const staleDialog = doc.querySelector("[role=dialog]")
		if (staleDialog) {
			console.debug("Dismissing stale dialog")
			const closeBtn = staleDialog.querySelector("button")
			if (closeBtn) closeBtn.click()
		}
		// Close stale dropdown menus by pressing Escape
		const activeMenu = doc.querySelector("[role=menu], [role=listbox]")
		if (activeMenu) {
			console.debug("Dismissing stale menu via Escape")
			doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
		}
	}

	/**
	 * Find the action button within the message row.
	 * Instagram moved aria-label from the button div to a nested SVG/title.
	 * Any match (SVG or div) is walked up to the nearest [role=button] ancestor.
	 *
	 * @param {Element} scope
	 * @returns {Element|null}
	 */
	_findActionButton(scope) {
		for (const sel of strings.LABEL_PATTERNS) {
			const el = scope.querySelector(sel)
			if (el) {
				// Always resolve to a clickable button container
				const btn = el.closest("[role=button]") || el.closest("button")
				if (btn && scope.contains(btn)) return btn
				// el itself is already a button-like element
				if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") return el
			}
		}

		// Fallback: any role=button with aria-haspopup=menu inside the message row
		return scope.querySelector("[role=button][aria-haspopup=menu]")
	}

	/**
	 * @param {AbortController} abortController
	 * @returns {Promise<HTMLButtonElement>}
	 */
	async showActionsMenuButton(abortController) {
		console.debug("Workflow step 1 : showActionsMenuButton", this.root)
		this._dismissStaleOverlays()

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
			if (abortController.signal.aborted) return null

			for (const target of hoverTargets) {
				dispatchHoverIn(target)
			}

			await new Promise(resolve => setTimeout(resolve, 100))

			const btn = this._findActionButton(this.root)
			if (btn) {
				console.debug("Workflow step 1 : found action button on attempt", attempt, btn)
				return btn
			}

			console.debug("Workflow step 1 : attempt", attempt, "no button found, retrying...")
			dispatchHoverOut(this.root)
			await new Promise(resolve => setTimeout(resolve, 50))
		}

		// Final fallback: use waitForElement with extended timeout
		const waitAbortController = new AbortController()
		let promiseTimeout
		const abortHandler = () => {
			waitAbortController.abort("showActionsMenuButton step was aborted by the parent process")
			clearTimeout(promiseTimeout)
		}
		abortController.signal.addEventListener("abort", abortHandler)

		for (const target of hoverTargets) {
			dispatchHoverIn(target)
		}

		try {
			const actionButton = await Promise.race([
				this.waitForElement(
					this.root,
					() => this._findActionButton(this.root),
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
	async hideActionMenuButton(abortController) {
		console.debug("hideActionMenuButton", this.root)
		dispatchHoverOut(this.root)

		const noneEl = this.root.querySelector("[role=none]")
		if (noneEl) {
			dispatchHoverOut(noneEl)
		}

		const waitAbortController = new AbortController()
		let promiseTimeout
		let resolveTimeout
		const abortHandler = () => {
			waitAbortController.abort("hideActionMenuButton step was aborted by the parent process")
			clearTimeout(promiseTimeout)
			if (resolveTimeout) {
				resolveTimeout()
			}
		}
		abortController.signal.addEventListener("abort", abortHandler)

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
	async openActionsMenu(actionButton, abortController) {
		console.debug("Workflow step 2 : Clicking actionButton and waiting for unsend menu item to appear", actionButton)
		const waitAbortController = new AbortController()
		let promiseTimeout
		let resolveTimeout
		const abortHandler = () => {
			waitAbortController.abort("openActionsMenu step was aborted by the parent process")
			clearTimeout(promiseTimeout)
			if (resolveTimeout) {
				resolveTimeout()
			}
		}
		abortController.signal.addEventListener("abort", abortHandler)

		/** Check if text matches any known "Unsend" variant */
		const isUnsendText = (text) => {
			const normalized = text.trim().toLocaleLowerCase()
			return strings.UNSEND_TEXT_VARIANTS.some(v => normalized === v)
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
	async closeActionsMenu(actionButton, actionsMenuElement, abortController) {
		console.debug("closeActionsMenu")
		const waitAbortController = new AbortController()
		let promiseTimeout
		let resolveTimeout
		const abortHandler = () => {
			waitAbortController.abort("closeActionsMenu step was aborted by the parent process")
			clearTimeout(promiseTimeout)
			if (resolveTimeout) {
				resolveTimeout()
			}
		}
		abortController.signal.addEventListener("abort", abortHandler)

		try {
			const result = await Promise.race([
				this.clickElementAndWaitFor(
					actionButton,
					this.root.ownerDocument.body,
					() => this.root.ownerDocument.body.contains(actionsMenuElement) === false,
					abortController
				),
				new Promise((resolve, reject) => {
					promiseTimeout = setTimeout(() => reject("Timeout closeActionsMenu"), 500)
				})
			])
			return result !== null
		} finally {
			waitAbortController.abort()
			clearTimeout(promiseTimeout)
			abortController.signal.removeEventListener("abort", abortHandler)
		}
	}

	/**
	 * Click unsend button and wait for the confirmation dialog.
	 *
	 * @param {HTMLSpanElement} unsendButton
	 * @param {AbortController} abortController
	 * @returns {Promise<HTMLButtonElement>|Promise<Error>}
	 */
	openConfirmUnsendModal(unsendButton, abortController) {
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
	async confirmUnsend(dialogButton, abortController) {
		console.debug("Workflow final step : confirmUnsend", dialogButton)
		await this.clickElementAndWaitFor(
			dialogButton,
			this.root.ownerDocument.body,
			() => this.root.ownerDocument.querySelector("[role=dialog] button") === null,
			abortController
		)
	}

}

export default UIMessage
