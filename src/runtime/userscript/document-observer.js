import { Observable } from "../../event/observable.js"
import { waitForElement } from "../../dom/async-events.js"

export { DocumentObserver }

/**
 * @param {Window} window
 */
function DocumentObserver(window) {
	if(!this.constructor.targetSelector) {
		throw new Error("targetSelector must be set on the constructor")
	}
	Observable.prototype.constructor.call(this)
	this.window = window
	this.observing = false
	this.entered = false
}
DocumentObserver.prototype = Object.create(Observable.prototype)
DocumentObserver.prototype.constructor = DocumentObserver

function observe(window) {
	if(this.observingPage) {
		throw new Error("observe can only be called once")
	}
	this.observingPage = true
	onElementConnected(this.constructor.targetSelector, (error) => {
		const { window } = this
		if(error) {
			console.error("DocumentObserver could not find relevant element", targetSelector)
		} else if(this._test()) {
			console.debug("DocumentObserver entering thread page")
			this.entered = true
			this.emit("enter")
		} else if(this.entered) {
			this.entered = false
			console.debug("DocumentObserver leaving thread page")
			this.emit("leave")
		}
	})
}

function onElementConnected = async function(querySelector, callback) {
	const { document } = this.window
	try {
		const element = await waitForElement(document, () => document.querySelector(querySelector) === null)
		callback(null, element)
	} catch(error) {
		console.error(error)
		callback(error)
	}
}

