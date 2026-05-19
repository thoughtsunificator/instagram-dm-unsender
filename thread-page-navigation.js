import { PageNavigation } from "./page-navigation.js"
import { PageObservable } from "./page-observable.js"
import { ThreadsPage, ThreadsPageDocument } from "../../../../instagram/thread-page.js"
import { MessagesWrapper } from "../../../../instagram/messages-wrapper.js"

export { ThreadPageNavigation }

function Thread() {

}

/*
 * Attempt to detect whether the observable is the threads page
 */
function ThreadPageNavigation(page) {
	observable.document.query("[id^=mount] > div > div > div")
	this.entered = false
	// TODO observers need to be global state
	// one observer for all page observable
	this.observer.observe()
	observable.on("mutation", () => {
		if(window.location.pathname.startsWith("/direct/t/") &&
			querySelector("[id^=mount] > div > div > div")) {
			console.debug("ThreadPageNavigation: Looking for messages wrapper")
			const messagesWrapperElement = findMessagesWrapper(window)
			if (messagesWrapperElement !== null) {
				this.entered = true
				console.debug("Found it:", messagesWrapperElement)
				const messagesWrapper = new MessageWrapper(messagesWrapperElement)
				// PageContent
				const content = new Thread(messagesWrapper)
				this.emit("enter", content)
			} else {
				throw new Error("Unable to find messages wrapper, This is a fatal error. The query selector might be out of date. Please open an issue: https://github.com/thoughtsunificator/instagram-dm-unsender/issues/new?template=bug_report.md")
			}
		} else {
			this.emit("leave", content)
		}
	})
}
ThreadPageNavigation.prototype = Object.create(PageNavigation.prototype)
ThreadPageNavigation.prototype.constructor = PageNavigation


