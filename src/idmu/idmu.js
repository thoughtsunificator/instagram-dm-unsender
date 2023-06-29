
import Instagram from "../instagram/instagram.js"

export default class IDMU {

	/**
	 *
	 * @param {Window} window
	 */
	constructor(window) {
		this.instagram = new Instagram(window)
	}

	async unsendMessages() {
		console.debug("User asked for messages unsending")
		return this.instagram.clearUnsendQueue()
	}

	getMessages() {
		return this.instagram.messages
	}

}
