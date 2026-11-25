import { Observable } from "../../event/observable.js"
import { discoverThread } from "./content/thread.js"

export { PageNavigation }

/**
 * Watches the page and emits "enter" (thread), "leave" (thread) and "error" (Error) events.
 *
 * @param {Window}   window
 * @param {function(Window): Thread|null} [discover=discoverThread]
 */
function PageNavigation(window, discover = discoverThread) {
	Observable.call(this)
	this.window = window
	this.discover = discover
	this.current = null
	this.errored = false
	this.observer = new MutationObserver(() => this.check())
}
PageNavigation.prototype = Object.create(Observable.prototype)
PageNavigation.prototype.constructor = PageNavigation

PageNavigation.prototype.start = function() {
	this.observer.observe(this.window.document.body, { childList: true, subtree: true })
	this.check()
}

PageNavigation.prototype.stop = function() {
	this.observer.disconnect()
	if(this.current) {
		const previous = this.current
		this.current = null
		this.emit("leave", previous)
	}
}

/**
 * Compares the page with the last known state and emits what changed
 */
PageNavigation.prototype.check = function() {
	let thread
	try {
		thread = this.discover(this.window)
		this.errored = false
	} catch(error) {
		if(!this.errored) {
			this.errored = true
			this.emit("error", error)
		}
		return
	}
	const unchanged = (this.current === null && thread === null) || (this.current && thread && this.current.root === thread.root)
	if(unchanged) {
		return
	}
	if(this.current) {
		const previous = this.current
		this.current = null
		this.emit("leave", previous)
	}
	if(thread) {
		this.current = thread
		this.emit("enter", thread)
	}
}
