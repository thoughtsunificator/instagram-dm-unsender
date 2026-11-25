export { Observable }

/**
 * Minimal event emitter shared by workflows, page navigation and UI components.
 */
function Observable() {
	this._listeners = new Map()
}

/**
 * @param {string}   name
 * @param {function} listener
 * @returns {Observable}
 */
Observable.prototype.on = function(name, listener) {
	if(!this._listeners.has(name)) {
		this._listeners.set(name, [])
	}
	this._listeners.get(name).push(listener)
	return this
}

/**
 * @param {string}   name
 * @param {function} listener
 * @returns {Observable}
 */
Observable.prototype.off = function(name, listener) {
	const listeners = this._listeners.get(name)
	if(listeners) {
		this._listeners.set(name, listeners.filter(candidate => candidate !== listener))
	}
	return this
}

/**
 * Calls every listener registered for name, in registration order.
 * A listener throwing does not prevent the others from being called.
 *
 * @param {string} name
 * @param {...any} args
 */
Observable.prototype.emit = function(name, ...args) {
	for(const listener of this._listeners.get(name) ?? []) {
		try {
			listener(...args)
		} catch(error) {
			console.error(error)
		}
	}
}
