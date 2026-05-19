import { Message } from "./message.js"

export { ThreadsPage }

/**
 * Finds the scrollable messages container inside the conversation panel.
 *
 * This container holds messages for both parties as well as other elements
 * such as the current date.
 *
 * @param {Window} window
 * @returns {HTMLDivElement|null}
 */
function findMessagesWrapper(window) {
	return window.document.querySelector("[data-pagelet='IGDMessagesList']")
}

function findStaleDialogs(window) {
	return window.document.querySelectorAll("[role=dialog]")
}

function findStaleMenus(window) {
	return window.document.querySelectorAll("[role=menu], [role=listbox]")
}

function findVisibleLoader(root) {
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

/**
 * @param {MessageWrapper} messageWrapper
 */
function ThreadsPage(messageWrapper) {
	InstagramPage.prototype.constructor.call(this)
	this.messageWrapper = messageWrapper
}
ThreadsPage.prototype = Object.create(InstagramPage.prototype)
ThreadsPage.prototype.constructor = ThreadsPage

/**
 * @returns {Promise}
 */
ThreadsPage.prototype.loadMessages = async function() {
	this.messageWrapper.loadMessages()
	// Fallback: wait for progressbar to appear (with shorter timeout)
	let loadingElement
	try {
		loadingElement = await Promise.race([
			this.waitForElement(root, () => {
				if (findVisibleLoader() === null) {
					root.scrollTop = scrollToTopValue
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
	} catch (error) {
		console.error(error)
	}
	scrollAbortController.abort("Scrolling took too much time. Timeout after 10s")
	clearTimeout(findLoaderTimeout)
	if (loadingElement && loadingElement !== true) {
		console.debug("loadMessages: Found loader; Stand-by until it is removed (max 5s)")
		await Promise.race([
			this.waitForElement(root, () => findVisibleLoader() === null, abortController),
			new Promise(resolve => setTimeout(resolve, 5000))
		])
	}
	const finishedScrolling = root.scrollTop === 0
	console.debug(`loadMessages: scrollTop is ${root.scrollTop} — ${finishedScrolling ? "reached last page" : "not last page"}`)
	return finishedScrolling
}

/**
 * Scroll until a (visible) message is found and return it.
 *
 * Instagram uses flex-direction: column-reverse on the messages container.
 * This means scrollTop=0 is the BOTTOM (newest messages) and scrolling to
 * older messages requires NEGATIVE scrollTop values.
 *
 * @returns {Promise<Message|false>}
 */
ThreadsPage.prototype.fetchNextMessage = async function() {
	console.debug("UI fetchNextMessage", this.lastScrollTop)
	this.messageWrapper.scrollUntilMessage()
}

/**
 * Dismiss any stale dialog or dropdown left from a previous failed workflow.
 */
ThreadsPage.prototype.dismissStaleOverlays = function() {
	// Close stale confirmation dialogs
	const staleDialogs = findStaleDialogs(this.root.ownerDocument.defaultView)
	for (const staleDialog of staleDialogs) {
		console.debug("Dismissing stale dialog", staleDialog)
		const closeBtn = staleDialog.querySelector("button")
		if (closeBtn) {
			closeBtn.click()
		}
	}
	if (this.hasStaleMenu()) {
		console.debug("Dismiss stale menus by emulating Escape key")
		this.root.ownerDocument.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
	}
}

ThreadsPage.prototype.hasStaleMenu = function() {
	return window.document.querySelector("[role=menu], [role=listbox]") !== null
}

