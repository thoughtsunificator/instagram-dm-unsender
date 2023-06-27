export class Task {
	/**
	* @abstract
	* @returns {Promise}
	*/
	run() {
		throw new Error("run method not implemented")
	}
}

export class MessageUnsendTask extends Task {
	/**
	 *
	 * @param {data} message
	 */
	constructor(message) {
		super()
		this.message = message
	}
	run() {
		this.message.task = this
		return this.message.unsend()
	}
}
