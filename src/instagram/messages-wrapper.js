import { WorkflowElement } from "../workflow/workflow-element.js"

function MessagesWrapper(root, page) {
	WorkflowElement.prototype.constructor.call(this, root, page)
	this._scrollUntilMessage = new ScrollUntilMessage(pageDocument.messagesWrapper)
	this._loadMoreMessages = new LoadMoreMessages(pageDocument.messagesWrapper)
}
MessagesWrapper.prototype = Object.create(WorkflowElement)
MessagesWrapper.prototype.constructor = Message

/**
 * Retrieve a batch of candidate elements and run a serie of tests until one candidate remains
 *
 * The selected candidate is expected to be the first visible message sent by us
 *
 * @param {Element} root - The scrollable messages wrapper
 * @returns {Element|undefined}
 */
function getFirstVisibleMessage(root) {
	// Fish for a whole bunch of candidates based on ... absolutely, nothing
	// The only prerequisites is to be a descendant of the root element which is the message wrapper
	const candidateElements = [...root.querySelectorAll("div")]
	if(candidateElements.length >= 1) {
		console.debug("getFirstVisibleMessage", candidateElements.length, "candidate elements")
	} else {
		console.debug("getFirstVisibleMessage: no candidate elements found")
	}
	console.debug("Filtering candidates Elements...")
	for(const element of candidateElements) {
		const { retained, reason } = testCandidate(element)
		if(retained) {
			console.debug("A valid candidate was found", element)
			return element
		} else {
			console.debug("Candidate not retained, reason:", reason)
			element.setAttribute("data-idmu-ignore", "")
		}
	}
	console.debug("No candidate retained")
}

MessageWrapper.prototype.scrollUntilMessage = function() {
	this._scrollUntilMessage.run()
}

/**
 * Run a series of tests to determine whether
 * a given element is a valid candidate
 * @param   {Element} element - Any element that might be a message
 * @returns {object}  report
 *					{boolean} report.retained
 *					{string}  report.reason
 */
function testCandidate(element) {
	const window = element.ownerDocument.defaultView
	if (element.hasAttribute("data-idmu-ignore")) {
		return { retained: false, reason: "has ignore attribute" }
	}
	if (element.hasAttribute("data-idmu-unsent")) {
		return { retained: false, reason: "already unsent" }
	}
	// Must contain message content indicators
	const hasMessageContent = element.querySelector("[role=none]") || element.querySelector("[role=presentation]")
	if (!hasMessageContent) {
		return { retained: false, reason: "does not have either role=none or role=presentation attribute set." }
	}
	const computedStyle = window.getComputedStyle(element)
	if (computedStyle.justifyContent !== "flex-end") {
		return { retained: false, reason: "justify-content should be flex-end" }
	}
	const visibilityCheck = element.checkVisibility({
		visibilityProperty: true,
		contentVisibilityAuto: true,
		opacityProperty: true,
	})
	if (visibilityCheck === false) {
		return { retained: false, reason: "visiblity check failed" }
	}
	const rect = element.getBoundingClientRect()
	// Check if element is at least partially in viewport.
	// For tall elements (images, long text), rect.y can be negative
	// while the element is still visible. Use bottom edge instead.
	if (rect.y + rect.height < 0 || rect.height === 0) {
		return { retained: false, reason: "viewport check failed" }
	}
	// It is expected that the ideal candidate will hold the message within no
	// more than 10 children
	const treeWalker = window.document.createTreeWalker(element)
	let childrenCount = 0
	const maxChildren = 10
	while(treeWalker.nextNode()) {
		childrenCount++
		if (childrenCount  > maxChildren) {
			return { retained: false, reason: `is above the children treshold (${maxChildren}), counted ${childrenCount} children instead.` }
		}
	}
	return { retained: true }
}

/**
 * Scroll to discover possible message candidates
 * The selected candidate should be the most recent message sent by us
 */
function ScrollUntilMessage(messagesWrapper) {
	// Scroll can be resumed if needed
	this.scrollTop = null
	this.messagesWrapper = messagesWrapper
}
ScrollUntilMessage.prototype = Object.create(Workflow)
ScrollUntilMessage.prototype.constructor = ScrollUntilMessage

ScrollUntilMessage.prototype.run = function() {
	const { root } = this.messagesWrapper
	// Even though all pages have been loaded, messages that are no longer inside
	// the viewport are automatically removed
	// Keep scrolling step by step to make them reappear
	const maxScroll = root.scrollHeight - root.clientHeight
	const startScrollTop = (pass === 0 && this.scrollTop !== null)
		? Math.min(this.scrollTop, maxScroll)
		: maxScroll
	// Use smaller increments for short conversations
	const step = maxScroll < 500 ? 30 : 150
	console.debug(`ScrollUntilMessage startScrollTop=${startScrollTop}, maxScroll=${maxScroll}, step=${step}`)
	for (let i = Math.max(1, startScrollTop); i > 0; i = i - step) {
		this.scrollTop = i
		root.scrollTop = i
		root.dispatchEvent(new root.Event("scroll"))
		await new Promise(resolve => setTimeout(resolve, 5))
		try {
			const messageElement = getFirstVisibleMessage(root)
			if (messageElement) {
				return new Message(this, messageElement)
			}
		} catch (error) {
			console.error(error)
		}
	}
}

function LoadMoreMessages(messagesWrapper) {
	Workflow.prototype.constructor.call(this)
	const { root } = messagesWrapper
	this.initialScrollTop = root.scrollTop
	this.initialScrollHeight = root.scrollHeight
}
LoadMoreMessages.prototype = Object.create(Workflow.prototype)
LoadMoreMessages.prototype.constructor = LoadMoreMessages

LoadMoreMessages.prototype.run = function() {
	const { root } = this.messagesWrapper
	// Set scroll top to 0 to simulate user scrolling to load more messages
	root.scrollTop = 0
	// At this point, as a result of this scrolling it is expected that some sort of loaded will appear
	if (root.scrollTop === 0) {
		// Check if a visible loader appeared
		const loader = findVisibleLoader()
		if (loader) {
			console.debug("loadMessages: Found visible loader after scroll; waiting for removal (max 5s)")
			await Promise.race([
				this.waitForElement(root, () => findVisibleLoader() === null, abortController),
				new Promise(resolve => setTimeout(resolve, 5000))
			])
			const grew = root.scrollHeight > initialScrollHeight
			console.debug(`loadMessages: loader phase done, content ${grew ? "grew" : "did not grow"}`)
			return !grew
		}
		// No loader appeared — check if scrollHeight grew (new content loaded without spinner)
		const grew = root.scrollHeight > initialScrollHeight
		if (!grew) {
			console.debug("loadMessages: at top, no loader, no new content — reached last page")
			return true
		}
	}
}



