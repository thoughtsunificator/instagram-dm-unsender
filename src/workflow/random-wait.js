async function RandomWait() {
	const elapsed = Date.now() - this._lastUnsendDate.getTime()
	const minDelay = 1000 + Math.floor(Math.random() * 1000) // 1-2s
	if (elapsed < minDelay) {
		const waitMs = minDelay - elapsed
		await new Promise(resolve => setTimeout(resolve, waitMs))
	}
}

