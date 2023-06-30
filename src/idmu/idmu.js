import UPI from "../upi/upi.js"

export default class IDMU {

	/**
	 *
	 * @param {Window} window
	 */
	constructor(window) {
		this.window = window
		this.upi = null
	}

	async unsendThreadMessages() {
		console.debug("User asked for messages unsending")
		return this.#getUPI().unsendThreadMessages()
	}

	async loadThreadMessages() {
		return this.#getUPI().loadThreadMessages()
	}

	getMessages() {
		return this.#getUPI().messages
	}

	/**
	 *
	 * @returns {UPI}
	 */
	#getUPI() {
		if(this.upi === null) {
			this.upi = UPI.create(this.window)
		}
		return this.upi
	}

}
