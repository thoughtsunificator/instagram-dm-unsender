export { sleep, backoffDelay, randomDelay }

/**
 * Resolves after ms milliseconds, or rejects as soon as signal is aborted.
 *
 * @param {number}          ms
 * @param {AbortSignal}     [signal]
 * @returns {Promise<void>}
 */
function sleep(ms, signal) {
	return new Promise((resolve, reject) => {
		if(signal?.aborted) {
			reject(new Error(`sleep aborted: ${signal.reason}`))
			return
		}
		const onAbort = () => {
			clearTimeout(timer)
			reject(new Error(`sleep aborted: ${signal.reason}`))
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort)
			resolve()
		}, ms)
		signal?.addEventListener("abort", onAbort, { once: true })
	})
}

/**
 * Exponential backoff: baseMs, 2*baseMs, 4*baseMs... capped at maxMs
 *
 * @param {number} attempt - 1 for the first failure
 * @param {number} baseMs
 * @param {number} maxMs
 * @returns {number}
 */
function backoffDelay(attempt, baseMs, maxMs) {
	return Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt - 1)))
}

/**
 * Random delay in the inclusive range [minMs, maxMs]
 *
 * @param {number} minMs
 * @param {number} maxMs
 * @param {function(): number} [random=Math.random]
 * @returns {number}
 */
function randomDelay(minMs, maxMs, random = Math.random) {
	return minMs + Math.floor(random() * (maxMs - minMs + 1))
}
