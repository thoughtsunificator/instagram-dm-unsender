/** @module default-ui Default UI / English UI */

import UI from "../ui.js"
import { findMessagesWrapper, getFirstVisibleMessage } from "./dom-lookup.js"
import UIPIMessage from "../../uipi/uipi-message.js"
import UIMessage from "./ui-message.js"
import UIMessagesWrapper from "./ui-messages-wrapper.js"

class DefaultUI extends UI {

	constructor(root, identifier = {}) {
		super(root, identifier)
		this.lastScrollTop = null
	}

	/**
	 * @param {Window} window
	 * @returns {DefaultUI}
	 */
	static create(window) {
		console.debug("UI create: Looking for messagesWrapperElement")
		const messagesWrapperElement = findMessagesWrapper(window)
		if (messagesWrapperElement !== null) {
			console.debug("Found messagesWrapperElement", messagesWrapperElement)
			const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
			return new DefaultUI(window, { uiMessagesWrapper })
		} else {
			throw new Error("Unable to find messagesWrapperElement. The query selector might be out of date.")
		}
	}

	/**
	 * @param {AbortController} abortController
	 * @returns {Promise}
	 */
	async fetchAndRenderThreadNextMessagePage(abortController) {
		console.debug("UI fetchAndRenderThreadNextMessagePage")
		return await this.identifier.uiMessagesWrapper.fetchAndRenderThreadNextMessagePage(abortController)
	}

	/**
	 * Scroll until a (visible) message is found and return it.
	 *
	 * Instagram uses flex-direction: column-reverse on the messages container.
	 * This means scrollTop=0 is the BOTTOM (newest messages) and scrolling to
	 * older messages requires NEGATIVE scrollTop values.
	 * In normal (non-reversed) layouts, scrollTop=0 is the top and the max is positive.
	 *
	 * This method detects the layout direction and scrolls accordingly.
	 *
	 * @param {AbortController} abortController
	 * @returns {Promise<UIPIMessage|false>}
	 */
	async getNextUIPIMessage(abortController) {
		console.debug("UI getNextUIPIMessage", this.lastScrollTop)
		const uiMessagesWrapperRoot = this.identifier.uiMessagesWrapper.root

		// Detect column-reverse: scrollTop can go negative
		const style = this.root.getComputedStyle
			? this.root.getComputedStyle(uiMessagesWrapperRoot)
			: uiMessagesWrapperRoot.ownerDocument.defaultView.getComputedStyle(uiMessagesWrapperRoot)
		const isReversed = style.flexDirection === "column-reverse"

		// Allow up to 3 full passes; covers cases where DOM shrinks after unsends
		for (let pass = 0; pass < 3; pass++) {
			if (isReversed) {
				// column-reverse: scrollTop ranges from 0 (bottom/newest) to negative (top/oldest)
				// minScroll is the most negative value (furthest back in history)
				const minScroll = -(uiMessagesWrapperRoot.scrollHeight - uiMessagesWrapperRoot.clientHeight)
				const startPos = (pass === 0 && this.lastScrollTop !== null)
					? Math.max(this.lastScrollTop, minScroll)
					: 0 // Start from bottom (newest)
				console.debug(`getNextUIPIMessage [reversed] pass=${pass}, startPos=${startPos}, minScroll=${minScroll}`)

				// Scroll from startPos toward minScroll (more negative = older messages)
				for (let i = startPos; i >= minScroll; i = i - 150) {
					if (abortController.signal.aborted) {
						console.debug("abortController interupted the scrolling: stopping...")
						return false
					}
					this.lastScrollTop = i
					uiMessagesWrapperRoot.scrollTop = i
					uiMessagesWrapperRoot.dispatchEvent(new this.root.Event("scroll"))
					await new Promise(resolve => setTimeout(resolve, 5))
					try {
						const messageElement = getFirstVisibleMessage(uiMessagesWrapperRoot, abortController, this.root)
						if (messageElement) {
							const uiMessage = new UIMessage(messageElement)
							return new UIPIMessage(uiMessage)
						}
					} catch (ex) {
						console.error(ex)
					}
				}
			} else {
				// Normal layout: scrollTop ranges from 0 (top) to positive max (bottom)
				const maxScroll = uiMessagesWrapperRoot.scrollHeight - uiMessagesWrapperRoot.clientHeight
				const startScrollTop = (pass === 0 && this.lastScrollTop !== null)
					? Math.min(this.lastScrollTop, maxScroll)
					: maxScroll
				console.debug(`getNextUIPIMessage pass=${pass}, startScrollTop=${startScrollTop}, maxScroll=${maxScroll}`)

				for (let i = Math.max(1, startScrollTop); i > 0; i = i - 150) {
					if (abortController.signal.aborted) {
						console.debug("abortController interupted the scrolling: stopping...")
						return false
					}
					this.lastScrollTop = i
					uiMessagesWrapperRoot.scrollTop = i
					uiMessagesWrapperRoot.dispatchEvent(new this.root.Event("scroll"))
					await new Promise(resolve => setTimeout(resolve, 5))
					try {
						const messageElement = getFirstVisibleMessage(uiMessagesWrapperRoot, abortController, this.root)
						if (messageElement) {
							const uiMessage = new UIMessage(messageElement)
							return new UIPIMessage(uiMessage)
						}
					} catch (ex) {
						console.error(ex)
					}
				}
			}

			// Reached the end without finding a message.
			// Reset for a fresh pass (DOM may have shrunk after unsends).
			this.lastScrollTop = null
			console.debug(`getNextUIPIMessage: pass ${pass} found nothing, retrying`)
		}

		console.debug("getNextUIPIMessage: exhausted all passes, no messages left")
		return false
	}

}

export default DefaultUI
