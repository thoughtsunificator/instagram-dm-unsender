import { PageObservable } from "./page-observable.js"
import { ThreadsPage, ThreadsPageDocument } from "../../../../instagram/thread-page.js"
import { MessagesWrapper } from "../../../../instagram/messages-wrapper.js"

export { ThreadsPageObservable }

/*
 * Attempt to detect whether the page is the threads page
 */
function ThreadsPageObservable(window) {
	const page = new PageObservable()
	page.location.pathname.startsWith("/direct/t/")
	page.document.query("[id^=mount] > div > div > div")
}
ThreadsPageObservable.prototype = Object.create(PageObservable.prototype)
ThreadsPageObservable.prototype.constructor = PageObservable

// TODO remove not flexible enough
// In addition to _test this specific selector should resolve to an Element
ThreadsPageObservable.targetSelector = "[id^=mount] > div > div > div"

// TODO remove not flexible enough
ThreadsPageObservable._test = function() {
	return window.location.pathname.startsWith("/direct/t/")
}

// TODO this method is world accessible
// should not be
ThreadsPageObservable.create = function() {
	console.debug("ThreadsPageObservable: Looking for messages wrapper")
	const messagesWrapperElement = findMessagesWrapper(window)
	if (messagesWrapperElement !== null) {
		console.debug("Found it:", messagesWrapperElement)
		const messagesWrapper = new MessageWrapper(messagesWrapperElement)
		return new ThreadsPage(messagesWrapper)
	} else {
		throw new Error("Unable to find messages wrapper, This is a fatal error. The query selector might be out of date. Please open an issue: https://github.com/thoughtsunificator/instagram-dm-unsender/issues/new?template=bug_report.md")
	}
}

