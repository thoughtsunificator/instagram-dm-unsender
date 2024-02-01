/** @module unsend-strategy Various strategies for unsending messages */

// eslint-disable-next-line no-unused-vars
import IDMU from "../../idmu/idmu.js"
import { UnsendStrategy } from "../unsend-strategy.js"
import { FailedWorkflowException } from "../../uipi/uipi-message.js"

/**
 * Loads multiple pages before unsending message
 */
class DefaultStrategy extends UnsendStrategy {



	/**
	 * @param {IDMU} idmu
	 */
	constructor(idmu) {
		super(idmu)
		this._allPagesLoaded = false
		this._unsentCount = 0
		this._pagesLoadedCount = 0
		this._running = false
		this._abortController = null
	}

	/**
	 *
	 * @returns {boolean}
	 */
	isRunning() {
		return this._running && this._abortController && this._abortController.signal.aborted === false
	}

	stop() {
		console.debug("DefaultStrategy stop")
		this.idmu.setStatusText("Stopping...")
		this._abortController.abort()
	}

	/**
	 *
	 * @returns {Promise}
	 */
	async run() {
		console.debug("DefaultStrategy.run()")
		this._unsentCount = 0
		this._pagesLoadedCount = 0
		this._running = true
		this._abortController = new AbortController()
		this.idmu.loadUIPI()
		try {
			if(this._allPagesLoaded) {
				await this.#unsendNextMessage()
			} else {
				await this.#loadNextPage()
			}
			if(this._abortController.signal.aborted) {
				this.idmu.setStatusText(`Aborted. ${this._unsentCount} message(s) unsent.`)
				console.debug("DefaultStrategy aborted")
			} else {
				this.idmu.setStatusText(`Done. ${this._unsentCount} message(s) unsent.`)
				console.debug("DefaultStrategy done")
			}
		} catch(ex) {
			console.error(ex)
			this.idmu.setStatusText(`Errored. ${this._unsentCount} message(s) unsent.`)
			console.debug("DefaultStrategy errored")
		}
		this._running = false
	}

	/**
	 * Tries to load the thread next page
	 */
	async #loadNextPage() {
		if(this._abortController.signal.aborted) {
			return
		}
		this.idmu.setStatusText("Loading next page...")
		try {
			const done = await this.idmu.fetchAndRenderThreadNextMessagePage(this._abortController)
			if(done) {
				this.idmu.setStatusText(`All pages loaded (${this._pagesLoadedCount} in total)...`)
				this._allPagesLoaded = true
				await this.#unsendNextMessage()
			} else {
				this._pagesLoadedCount++
				await this.#loadNextPage()
			}
		} catch(ex) {
			console.error(ex)
		}
	}

	/**
	 * Unsend first message in viewport
	 */
	async #unsendNextMessage() {
		if(this._abortController.signal.aborted) {
			return
		}
		try {
			this.idmu.setStatusText("Retrieving next message...")
			const uipiMessage = await this.idmu.getNextUIPIMessage(this._abortController)
			if(uipiMessage) {
				this.idmu.setStatusText("Unsending message...")
				await uipiMessage.unsend(this._abortController)
				this._unsentCount++
			}
		} catch(ex) {
			console.error(ex)
		}
		await new Promise(resolve => setTimeout(resolve, 1000)) // IDMU_MESSAGE_QUEUE_DELAY
		this.idmu.setStatusText("Waiting 1 second before unsending next message...")
		await this.#unsendNextMessage()
	}

}

export { DefaultStrategy }
