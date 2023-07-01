export class Task {
	constructor(id) {
		this.id = id
	}

	/**
	* @abstract
	* @returns {Promise}
	*/
	run() {
		throw new Error("run method not implemented")
	}
	/**
	* @abstract
	*/
	stop() {
		throw new Error("stop method not implemented")
	}
}

export class CancelableTask extends Task {
	constructor(id) {
		super(id)
		this.rejects = []
	}

}


export class UIPIMessageUnsendTask extends Task {
	/**
	 *
	 * @param {data} message
	 */
	constructor(id, message) {
		super(id)
		this.message = message
		this.runCount = 0
	}
	run() {
		const unsend = this.message.unsend()
		this.runCount++
		return unsend
	}
	stop() {
	}
}
