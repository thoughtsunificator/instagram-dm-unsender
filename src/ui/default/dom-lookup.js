/** @module dom-lookup Utils module for looking up elements on the default UI */

import { waitForElement } from "../../dom/async-events.js"

/**
 * Finds the scrollable messages container inside the conversation panel.
 * Instagram removed role="grid" — we now locate the container via aria-label
 * and walk into its scrollable child.
 *
 * @param {Window} window
 * @returns {HTMLDivElement|null}
 */
export function findMessagesWrapper(window) {
	const conversation = window.document.querySelector("[aria-label^='Conversation']")
	if (!conversation) {
		return null
	}
	const scrollable = findScrollableChild(conversation, window)
	if (!scrollable) {
		return null
	}
	return scrollable
}

/**
 * Recursively finds the first scrollable descendant of a given element.
 *
 * @param {Element} parent
 * @param {Window} window
 * @returns {HTMLDivElement|null}
 */
function findScrollableChild(parent, window) {
	for (const child of parent.children) {
		const style = window.getComputedStyle(child)
		if (
			(style.overflowY === "auto" || style.overflowY === "scroll") &&
			child.scrollHeight > child.clientHeight
		) {
			return child
		}
		const found = findScrollableChild(child, window)
		if (found) {
			return found
		}
	}
	return null
}

/**
 * Returns the inner container that holds individual message row divs.
 * Traverses wrapper layers to find the div with the most children (the message list).
 *
 * @param {Element} scrollable
 * @returns {HTMLDivElement}
 */
export function getMessagesInnerContainer(scrollable) {
	// Instagram wraps messages in several nested divs.
	// Strategy: find the deepest descendant (within 3 levels) that has the most children,
	// since the actual messages container has many direct children (one per message row).
	let best = scrollable
	let bestCount = scrollable.children.length

	function search(el, depth) {
		if (depth > 3) return
		for (const child of el.children) {
			if (child.children.length > bestCount) {
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
 * Determines whether a message element was sent by the current user.
 * Instagram aligns sent messages to the right using flexbox (justify-content: flex-end).
 *
 * @param {Element} element
 * @param {Window} window
 * @returns {boolean}
 */
export function isSentByCurrentUser(element, window) {
	// BFS through all descendants up to depth 8.
	// Instagram places justify-content: flex-end on a nested div (depth ~5)
	// that may be on any child branch, not just the first-child path.
	const queue = [{ el: element, depth: 0 }]
	while (queue.length > 0) {
		const { el, depth } = queue.shift()
		const s = window.getComputedStyle(el)
		if (s.justifyContent === "flex-end") {
			return true
		}
		if (depth < 8) {
			for (const child of el.children) {
				queue.push({ el: child, depth: depth + 1 })
			}
		}
	}
	return false
}

/**
 * Gets the first visible message sent by the current user that hasn't been processed yet.
 *
 * @param {Element} root - The scrollable messages wrapper
 * @param {AbortController} abortController
 * @param {Window} window
 * @returns {Element|undefined}
 */
export function getFirstVisibleMessage(root, abortController, window) {
	const innerContainer = getMessagesInnerContainer(root)
	if (!innerContainer) {
		console.debug("getFirstVisibleMessage: no inner container found")
		return
	}

	const elements = [...innerContainer.children]
		.filter(d => {
			if (d.hasAttribute("data-idmu-ignore")) return false
			if (d.hasAttribute("data-idmu-unsent")) return false
			// Must contain message content indicators
			const hasMessageContent = d.querySelector("[role=none]") || d.querySelector("[role=presentation]")
			if (!hasMessageContent) return false
			return isSentByCurrentUser(d, window)
		})

	elements.reverse()
	if(elements.length >= 1) {
		console.debug("getFirstVisibleMessage", elements.length, "candidate elements")
	} else {
		console.error("getFirstVisibleMessage could not find any elements. If there actually are messages on the page that means the query selector might be out of date.")
	}

	for (const element of elements) {
		if (abortController.signal.aborted) {
			break
		}
		const visibilityCheck = element.checkVisibility({
			visibilityProperty: true,
			contentVisibilityAuto: true,
			opacityProperty: true,
		})
		if (visibilityCheck === false) {
			console.debug("visibilityCheck", visibilityCheck)
			continue
		}
		const rect = element.getBoundingClientRect()
		// Check if element is at least partially in viewport.
		// For tall elements (images, long text), rect.y can be negative
		// while the element is still visible. Use bottom edge instead.
		if (rect.y + rect.height < 50 || rect.height === 0) {
			console.debug("isInView failed", rect.y, rect.height)
			continue
		}
		element.setAttribute("data-idmu-ignore", "")
		console.debug("Message in view, testing workflow...", element)
		return element
	}
}

/**
 * Scrolls to top to trigger loading of older messages.
 *
 * @param {Element} root
 * @param {AbortController} abortController
 * @returns {Promise<boolean>}
 */
export async function loadMoreMessages(root, abortController) {
	console.debug("loadMoreMessages looking for loader... ")
	const scrollAbortController = new AbortController()
	let findLoaderTimeout
	let resolveTimeout
	const abortHandler = () => {
		scrollAbortController.abort()
		clearTimeout(findLoaderTimeout)
		if (resolveTimeout) {
			resolveTimeout()
		}
	}
	abortController.signal.addEventListener("abort", abortHandler)

	const beforeScroll = root.scrollTop
	const beforeHeight = root.scrollHeight
	root.scrollTop = 0

	// Helper: find a visible loader within the scrollable root's viewport
	const findVisibleLoader = () => {
		const bars = root.querySelectorAll("[role=progressbar]")
		for (const bar of bars) {
			const rect = bar.getBoundingClientRect()
			const rootRect = root.getBoundingClientRect()
			// Must be within root's horizontal+vertical bounds and have dimensions
			if (rect.height > 0 && rect.y >= rootRect.y - 100 && rect.y <= rootRect.y + rootRect.height + 100) {
				return bar
			}
		}
		return null
	}

	// Short chat: everything fits in viewport, nothing to load
	if (beforeScroll === 0 && root.scrollHeight <= root.clientHeight + 50) {
		console.debug("loadMoreMessages: chat fits in viewport, marking as done")
		abortController.signal.removeEventListener("abort", abortHandler)
		return true
	}

	// Already at top after scrolling: wait briefly for new content, then check
	if (root.scrollTop === 0) {
		// Give Instagram a moment to start loading older messages
		await new Promise(resolve => setTimeout(resolve, 500))

		// Check if a visible loader appeared
		const loader = findVisibleLoader()
		if (loader) {
			console.debug("loadMoreMessages: Found visible loader after scroll; waiting for removal (max 5s)")
			await Promise.race([
				waitForElement(root, () => findVisibleLoader() === null, abortController),
				new Promise(resolve => setTimeout(resolve, 5000))
			])
			abortController.signal.removeEventListener("abort", abortHandler)
			const grew = root.scrollHeight > beforeHeight
			console.debug(`loadMoreMessages: loader phase done, content ${grew ? "grew" : "did not grow"}`)
			return !grew
		}

		// No loader appeared — check if scrollHeight grew (new content loaded without spinner)
		const grew = root.scrollHeight > beforeHeight
		if (!grew) {
			console.debug("loadMoreMessages: at top, no loader, no new content — reached last page")
			abortController.signal.removeEventListener("abort", abortHandler)
			return true
		}
	}

	// Fallback: wait for progressbar to appear (with shorter timeout)
	let loadingElement
	try {
		loadingElement = await Promise.race([
			waitForElement(root, () => {
				if (findVisibleLoader() === null) {
					root.scrollTop = 0
				}
				return findVisibleLoader()
			}, scrollAbortController),
			new Promise(resolve => {
				resolveTimeout = resolve
				findLoaderTimeout = setTimeout(() => {
					resolve()
				}, 3000)
			})
		])
	} catch (ex) {
		console.error(ex)
	}
	scrollAbortController.abort()
	abortController.signal.removeEventListener("abort", abortHandler)
	clearTimeout(findLoaderTimeout)
	if (loadingElement && loadingElement !== true) {
		console.debug("loadMoreMessages: Found loader; Stand-by until it is removed (max 5s)")
		await Promise.race([
			waitForElement(root, () => findVisibleLoader() === null, abortController),
			new Promise(resolve => setTimeout(resolve, 5000))
		])
	}
	console.debug(`loadMoreMessages: scrollTop is ${root.scrollTop} — ${root.scrollTop === 0 ? "reached last page" : "not last page"}`)
	return root.scrollTop === 0
}
