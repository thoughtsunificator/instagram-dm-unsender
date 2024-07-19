/** @module unsend-strategy Various strategies for unsending messages */

/* eslint-disable-next-line no-unused-vars */
import IDMU from "../idmu/idmu.js"

/**
 *
 * @abstract
 */
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
	reset() {
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

export { UnsendStrategy }
