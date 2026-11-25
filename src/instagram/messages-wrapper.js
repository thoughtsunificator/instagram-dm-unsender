import { WorkflowElement } from "../workflow/workflow-element.js"
import { sleep } from "../workflow/timing.js"
import { waitForElementWithTimeout } from "../dom/async-events.js"
import { Message } from "./message.js"

export { MessagesWrapper, getMessagesInnerContainer, isSentByCurrentUser, getFirstVisibleMessage, findVisibleLoader }

const IGNORED_ATTRIBUTE = "data-idmu-ignore"
const UNSENT_ATTRIBUTE = "data-idmu-unsent"
const MAX_SCAN_PASSES = 3

/**
 * The scrollable container holding the messages of a thread.
 *
 * Instagram uses flex-direction: column-reverse on this container: scrollTop=0 is the
 * newest message and the oldest messages are reached with negative scrollTop values.
 * Normal layouts are supported as well.
 *
 * @param {Element} root
 */
function MessagesWrapper(root) {
	WorkflowElement.call(this, root)
	this.lastScrollTop = null
}
MessagesWrapper.prototype = Object.create(WorkflowElement.prototype)
MessagesWrapper.prototype.constructor = MessagesWrapper

/**
 * @returns {boolean}
 */
MessagesWrapper.prototype.isColumnReversed = function() {
	return this.root.ownerDocument.defaultView.getComputedStyle(this.root).flexDirection === "column-reverse"
}

/**
 * Finds the next message sent by the current user that can be unsent, scrolling the
 * container when needed. Messages are looked for from the newest to the oldest.
 *
 * The returned message is marked as ignored so that the next call returns another one.
 *
 * @param {AbortController} abortController
 * @returns {Promise<Message|false>} false when no message is left
 */
MessagesWrapper.prototype.findNextMessage = async function(abortController) {
	const root = this.root
	const window = root.ownerDocument.defaultView
	const fromElement = () => {
		const element = getFirstVisibleMessage(root, abortController, window)
		return element ? new Message(element) : undefined
	}

	// Messages already in the viewport (short chats, or the DOM shrank after an unsend)
	const visible = fromElement()
	if(visible) {
		return visible
	}

	const reversed = this.isColumnReversed()
	const minScroll = -(root.scrollHeight - root.clientHeight)
	const maxScroll = root.scrollHeight - root.clientHeight
	const range = reversed ? Math.abs(minScroll) : maxScroll
	const step = range < 500 ? 30 : 150

	for(let pass = 0; pass < MAX_SCAN_PASSES; pass++) {
		let start
		let floor
		if(reversed) {
			start = pass === 0 && this.lastScrollTop !== null ? Math.max(this.lastScrollTop, minScroll) : 0
			floor = minScroll
		} else {
			start = pass === 0 && this.lastScrollTop !== null ? Math.min(this.lastScrollTop, maxScroll) : maxScroll
			floor = 1
		}
		console.debug(`findNextMessage pass=${pass} reversed=${reversed} start=${start} floor=${floor} step=${step}`)
		for(let position = Math.max(floor, start); position >= floor; position -= step) {
			if(abortController.signal.aborted) {
				return false
			}
			this.lastScrollTop = position
			root.scrollTop = position
			root.dispatchEvent(new window.Event("scroll"))
			await sleep(5, abortController.signal)
			const message = fromElement()
			if(message) {
				return message
			}
		}
		// Nothing found in this pass: the DOM may have changed, start again from the beginning
		this.lastScrollTop = null
	}
	return false
}

/**
 * Scrolls to the oldest messages so that Instagram loads the previous page.
 *
 * @param {AbortController} abortController
 * @returns {Promise<boolean>} true when there is no older page left
 */
MessagesWrapper.prototype.loadMore = async function(abortController) {
	const root = this.root
	const signal = abortController.signal
	const reversed = this.isColumnReversed()
	const scrollToTop = reversed ? -(root.scrollHeight - root.clientHeight) : 0
	const isAtTop = () => reversed ? root.scrollTop <= scrollToTop + 5 : root.scrollTop === 0

	const beforeScroll = root.scrollTop
	const beforeHeight = root.scrollHeight
	root.scrollTop = scrollToTop

	// Short chat: everything fits in the viewport
	if(beforeScroll === 0 && root.scrollHeight <= root.clientHeight + 50) {
		console.debug("loadMore: chat fits in viewport, nothing to load")
		return true
	}

	if(isAtTop()) {
		// Give Instagram a moment to start loading older messages
		await sleep(500, signal)
		if(findVisibleLoader(root)) {
			console.debug("loadMore: loader visible after scroll, waiting for its removal")
			await waitUntil(root, () => findVisibleLoader(root) === null, 5000, abortController)
			const grew = root.scrollHeight > beforeHeight
			console.debug(`loadMore: loader phase done, content ${grew ? "grew" : "did not grow"}`)
			return !grew
		}
		if(root.scrollHeight <= beforeHeight) {
			console.debug("loadMore: at top, no loader, no new content: reached last page")
			return true
		}
	}

	// Not at top yet: wait (max 3s) for a loader, scrolling again while none shows up
	const loader = await waitUntil(root, () => {
		if(findVisibleLoader(root) === null) {
			root.scrollTop = scrollToTop
		}
		return findVisibleLoader(root)
	}, 3000, abortController)
	if(loader) {
		console.debug("loadMore: found loader, standing by until it is removed (max 5s)")
		await waitUntil(root, () => findVisibleLoader(root) === null, 5000, abortController)
	}
	const atTop = isAtTop()
	console.debug(`loadMore: scrollTop is ${root.scrollTop}, ${atTop ? "reached last page" : "not last page"}`)
	return atTop
}

/**
 * Resolves with the element or true matched by getElement, or undefined on timeout/abort
 *
 * @param {Element}         root
 * @param {function}        getElement
 * @param {number}          timeoutMs
 * @param {AbortController} abortController
 * @returns {Promise<any>}
 */
async function waitUntil(root, getElement, timeoutMs, abortController) {
	try {
		return await waitForElementWithTimeout(root, getElement, timeoutMs, abortController)
	} catch(error) {
		console.debug(error.message)
		return undefined
	}
}

/**
 * A message row holds its content in a role=none or role=presentation child.
 * Rows are never the container: their own children (bubbles) would otherwise win on child count.
 *
 * @param {Element} element
 * @returns {boolean}
 */
function isRow(element) {
	return [...element.children].some(child => child.getAttribute("role") === "none" || child.getAttribute("role") === "presentation")
}

/**
 * Finds the element holding the message rows: the element (within 3 levels, rows excluded) with the most children
 *
 * @param {Element} scrollable
 * @returns {Element}
 */
function getMessagesInnerContainer(scrollable) {
	let best = scrollable
	let bestCount = scrollable.children.length
	const search = (element, depth) => {
		if(depth > 3) {
			return
		}
		for(const child of element.children) {
			if(isRow(child)) {
				continue
			}
			if(child.children.length > bestCount) {
				best = child
				bestCount = child.children.length
			}
			search(child, depth + 1)
		}
	}
	search(scrollable, 0)
	return best
}

/**
 * Sent messages are aligned to the right with justify-content: flex-end somewhere within a few levels
 *
 * @param {Element} element
 * @param {Window}  window
 * @returns {boolean}
 */
function isSentByCurrentUser(element, window) {
	const queue = [{ element, depth: 0 }]
	while(queue.length > 0) {
		const { element: current, depth } = queue.shift()
		if(window.getComputedStyle(current).justifyContent === "flex-end") {
			return true
		}
		if(depth < 8) {
			for(const child of current.children) {
				queue.push({ element: child, depth: depth + 1 })
			}
		}
	}
	return false
}

/**
 * Returns the first (newest) message in view that was sent by us and was not processed yet.
 * The returned element is flagged as ignored.
 *
 * @param {Element}         root
 * @param {AbortController} abortController
 * @param {Window}          window
 * @returns {Element|undefined}
 */
function getFirstVisibleMessage(root, abortController, window) {
	const innerContainer = getMessagesInnerContainer(root)
	const candidates = [...innerContainer.children]
		.filter(element => {
			if(element.hasAttribute(IGNORED_ATTRIBUTE) || element.hasAttribute(UNSENT_ATTRIBUTE)) {
				return false
			}
			const hasMessageContent = element.querySelector("[role=none]") || element.querySelector("[role=presentation]")
			return Boolean(hasMessageContent) && isSentByCurrentUser(element, window)
		})
		.reverse()
	for(const element of candidates) {
		if(abortController.signal.aborted) {
			break
		}
		if(element.checkVisibility && element.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true, opacityProperty: true }) === false) {
			continue
		}
		const rect = element.getBoundingClientRect()
		// Tall messages can start above the viewport while still being visible: test the bottom edge
		if(rect.y + rect.height < 0 || rect.height === 0) {
			continue
		}
		element.setAttribute(IGNORED_ATTRIBUTE, "")
		return element
	}
	return undefined
}

/**
 * @param {Element} root
 * @returns {Element|null} the visible progress bar inside root, if any
 */
function findVisibleLoader(root) {
	const rootRect = root.getBoundingClientRect()
	for(const bar of root.querySelectorAll("[role=progressbar]")) {
		const rect = bar.getBoundingClientRect()
		if(rect.height > 0 && rect.y >= rootRect.y - 100 && rect.y <= rootRect.y + rootRect.height + 100) {
			return bar
		}
	}
	return null
}
