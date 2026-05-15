async function Backoff() {
	this._consecutiveFailures++
	const backoffMs = Math.min(60000, 3000 * Math.pow(2, this._consecutiveFailures - 1))
	this.setStatusText(`Workflow failed (${this._consecutiveFailures}/5), retrying in ${(backoffMs / 1000).toFixed(0)}s... (${this._unsentCount} unsent)`)
	await new Promise(resolve => setTimeout(resolve, backoffMs))
}


