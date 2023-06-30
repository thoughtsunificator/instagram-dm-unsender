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
