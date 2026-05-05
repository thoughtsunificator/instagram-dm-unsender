/** @module unsend-strategy Various strategies for unsending messages */

/* eslint-disable-next-line no-unused-vars */
import IDMU from "../../idmu/idmu.js"
import { UnsendStrategy } from "../unsend-strategy.js"

const DEFAULT_TIMING = Object.freeze({
	random: Math.random,
	sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
})

/**
 * Loads all pages first, then unsends messages from bottom to top.
 * For short conversations (all messages fit in viewport), skips page loading entirely.
 */
class DefaultStrategy extends UnsendStrategy {

	/**
	 * @param {IDMU} idmu
	 * @param {{sleep?: Function, random?: Function}} timing
	 */
	constructor(idmu, timing={}) {
		super(idmu)
		this._allPagesLoaded = false
		this._unsentCount = 0
		this._pagesLoadedCount = 0
		this._running = false
		this._abortController = null
		this._lastUnsendDate = null
		this._consecutiveFailures = 0
		this._timing = { ...DEFAULT_TIMING, ...timing }
	}

	/**
	 * @returns {boolean}
	 */
	isRunning() {
		return this._running && this._abortController && this._abortController.signal.aborted === false
	}

	stop() {
		this.idmu.setStatusText("Stopping...")
		this._abortController.abort("DefaultStrategy stopped")
	}

	reset() {
		this._allPagesLoaded = false
		this._unsentCount = 0
		this._lastUnsendDate = null
		this._pagesLoadedCount = 0
		this._consecutiveFailures = 0
		this.idmu.setStatusText("Ready")
	}

	/**
	 * @returns {Promise}
	 */
	async run() {
		this._unsentCount = 0
		this._pagesLoadedCount = 0
		this._consecutiveFailures = 0
		this._running = true
		this._abortController = new AbortController()
		// Clear stale ignore markers from previous runs so messages can be retried
		this.idmu.window.document.querySelectorAll("[data-idmu-ignore]").forEach(el => {
			el.removeAttribute("data-idmu-ignore")
		})
		this.idmu.loadUIPI()
		try {
			if (this._allPagesLoaded) {
				await this.#unsendNextMessage()
			} else {
				await this.#loadNextPage()
			}

			// Race condition: on first page load, Instagram's React may not have
			// finished hydrating message components (role attributes missing).
			// If we found nothing, wait and re-scan up to 3 times.
			if (this._unsentCount === 0 && !this._abortController.signal.aborted) {
				for (let retry = 1; retry <= 3; retry++) {
					this.idmu.setStatusText(`No messages detected, retrying (${retry}/3)...`)
					await this._timing.sleep(2000)
					if (this._abortController.signal.aborted) break
					// Reset for fresh scan
					this._allPagesLoaded = false
					this._consecutiveFailures = 0
					this.idmu.window.document.querySelectorAll("[data-idmu-ignore]").forEach(el => {
						el.removeAttribute("data-idmu-ignore")
					})
					this.idmu.loadUIPI()
					await this.#loadNextPage()
					if (this._unsentCount > 0 || this._abortController.signal.aborted) break
				}
			}

			if (this._abortController.signal.aborted) {
				this.idmu.setStatusText(`Aborted. ${this._unsentCount} message(s) unsent.`)
			} else {
				this.idmu.setStatusText(`Done. ${this._unsentCount} message(s) unsent.`)
			}
		} catch (ex) {
			console.error(ex)
			this.idmu.setStatusText(`Errored. ${this._unsentCount} message(s) unsent.`)
		}
		this._running = false
	}

	/**
	 * Tries to load the thread next page.
	 * If loadMoreMessages returns true (no more pages), moves to unsending.
	 */
	async #loadNextPage() {
		if (this._abortController.signal.aborted) {
			return
		}
		this.idmu.setStatusText("Loading next page...")
		try {
			const done = await this.idmu.fetchAndRenderThreadNextMessagePage(this._abortController)
			if (this._abortController.signal.aborted === false) {
				if (done) {
					this.idmu.setStatusText(`All pages loaded (${this._pagesLoadedCount} in total). Unsending...`)
					this._allPagesLoaded = true
					await this.#unsendNextMessage()
				} else {
					this._pagesLoadedCount++
					await this.#loadNextPage()
				}
			}
		} catch (ex) {
			console.error(ex)
		}
	}

	/**
	 * Unsend first message in viewport.
	 * Uses adaptive delays: fast baseline (1-2s) with exponential backoff on rate limit detection.
	 */
	async #unsendNextMessage() {
		if (this._abortController.signal.aborted) {
			return
		}
		if (this._consecutiveFailures >= 5) {
			this.idmu.setStatusText(`Stopped: ${this._consecutiveFailures} consecutive failures. ${this._unsentCount} message(s) unsent.`)
			return
		}
		let canScroll = true
		let msgElement = null
		try {
			this.idmu.setStatusText(`Retrieving next message... (${this._unsentCount} unsent so far)`)
			const uipiMessage = await this.idmu.getNextUIPIMessage(this._abortController)
			canScroll = uipiMessage !== false
			if (uipiMessage) {
				this.idmu.setStatusText(`Unsending message... (${this._unsentCount + 1})`)

				// Adaptive delay: 1-2s randomized baseline between unsends
				if (this._lastUnsendDate !== null) {
					const elapsed = Date.now() - this._lastUnsendDate.getTime()
					const minDelay = 1000 + Math.floor(this._timing.random() * 1000)
					if (elapsed < minDelay) {
						const waitMs = minDelay - elapsed
						this.idmu.setStatusText(`Waiting ${(waitMs / 1000).toFixed(1)}s... (${this._unsentCount} unsent so far)`)
						await this._timing.sleep(waitMs)
					}
				}

				if (this._abortController.signal.aborted) return

				msgElement = uipiMessage.uiMessage.root
				const unsent = await uipiMessage.unsend(this._abortController)

				if (unsent) {
					// Verify the message actually disappeared from DOM (server accepted the mutation)
					await this._timing.sleep(800)
					const stillInDOM = msgElement.isConnected && !msgElement.hasAttribute("data-idmu-unsent")
					if (stillInDOM) {
						// Server likely rejected — the message reappeared after optimistic removal
						msgElement.removeAttribute("data-idmu-ignore")
						this._consecutiveFailures++
						const backoffMs = Math.min(60000, 5000 * Math.pow(2, this._consecutiveFailures - 1))
						this.idmu.setStatusText(`Rate limit detected. Backing off ${(backoffMs / 1000).toFixed(0)}s... (${this._unsentCount} unsent)`)
						await this._timing.sleep(backoffMs)
					} else {
						this._lastUnsendDate = new Date()
						this._unsentCount++
						this._consecutiveFailures = 0
						// DOM shrunk after removal; reset scroll for fresh scan
						if (this.idmu.uipi && this.idmu.uipi.ui) {
							this.idmu.uipi.ui.lastScrollTop = null
						}
					}
				} else {
					// Unsend workflow returned false — allow retry on next pass
					msgElement.removeAttribute("data-idmu-ignore")
					this._consecutiveFailures++
				}
			}
		} catch (ex) {
			console.error(ex)
			// Remove ignore marker so this message can be retried
			if (msgElement) {
				msgElement.removeAttribute("data-idmu-ignore")
			}
			this._consecutiveFailures++
			const backoffMs = Math.min(60000, 3000 * Math.pow(2, this._consecutiveFailures - 1))
			this.idmu.setStatusText(`Workflow failed (${this._consecutiveFailures}/5), retrying in ${(backoffMs / 1000).toFixed(0)}s... (${this._unsentCount} unsent)`)
			await this._timing.sleep(backoffMs)
		} finally {
			if (canScroll && this._abortController && !this._abortController.signal.aborted) {
				await this.#unsendNextMessage()
			}
		}
	}

}

export { DefaultStrategy }
