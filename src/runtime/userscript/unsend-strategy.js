/** @module unsend-strategy Various strategies for unsending messages */

// eslint-disable-next-line no-unused-vars
import IDMU from "../../idmu/idmu.js"

class UnsendStrategy {

	/**
	 *
	 * @param {IDMU} idmu
	 */
	constructor(idmu) {
		this._idmu = idmu
	}

	/**
	 *
	 * @abstract
	 * @returns {boolean}
	 */
	isRunning() {
	}

	/**
	 *
	 * @abstract
	 */
	stop() {
	}

	/**
	 *
	 * @abstract
	 */
	async run() {
	}

	/**
	 * @readonly
	 * @type {IDMU}
	 */
	get idmu() {
		return this._idmu
	}

}


/**
 * Loads multiple pages before unsending message
 */
class DefaultStrategy extends UnsendStrategy {



	/**
	 * @param {IDMU} idmu
	 */
	constructor(idmu) {
		super(idmu)
		this._running = false
		this._stopped = false
		this._unsentCounter = 0
	}

	/**
	 *
	 * @returns {boolean}
	 */
	isRunning() {
		return this._running && !this._stopped
	}

	stop() {
		console.debug("DefaultStrategy stop")
		this._stopped = true
	}

	/**
	 *
	 * @returns {Promise}
	 */
	run() {
		console.debug("DefaultStrategy.run()")
		this._running = true
		this._stopped = false
		this._unsentCounter = 0
		return this.#next()
	}

	async #next() {
		let done = false
		// Find out if we can load another page of messages
		try {
			this.idmu.setStatusText("Searching for messages...")
			const uipiMessages = await this.idmu.createUIPIMessages()
			uipiMessages.reverse()
			if(uipiMessages.length >= 1) {
				for(const uipiMessage of uipiMessages) {
					this.idmu.setStatusText(`Found ${uipiMessages.length} messages, unsending...`)
					if(this._stopped) {
						break
					}
					try {
						await uipiMessage.unsend()
						this._unsentCounter++
						this.idmu.setStatusText("Waiting 1 second before unsending next message...")
						await new Promise(resolve => setTimeout(resolve, 1000)) // IDMU_MESSAGE_QUEUE_DELAY
					} catch(result) {
						console.error(result)
					}
				}
			} else {
				this.idmu.setStatusText("No more messages; Searching for additional pages...")
				console.debug("No more messages; fetchAndRenderThreadNextMessagePage", done)
				const hasMoreMessages = (await this.idmu.createUIPIMessages()).length >= 1
				done = hasMoreMessages === false && (await this.idmu.fetchAndRenderThreadNextMessagePage())
			}
		} catch(ex) {
			console.error(ex)
		}
		if(done) {
			this.idmu.setStatusText(`Done. ${this._unsentCounter} messages unsent.`)
			clearInterval(this.interval)
			this._running = false
			console.debug("DefaultStrategy done")
		} else if(!this._stopped) { // Try to load the next page if there is any
			this.idmu.setStatusText("Waiting 1 second before next iteration...")
			await new Promise(resolve => setTimeout(resolve, 1000)) // IDMU_NEXT_MESSAGE_PAGE_DELAY
			return this.#next()
		}
	}

}

export { UnsendStrategy, DefaultStrategy }
