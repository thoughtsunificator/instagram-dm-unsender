
export class UnsendThreadMessagesBatchStrategy {

	static DEFAULT_BATCH_SIZE = 5

	#idmu
	#onUnsuccessfulWorkflows
	#finished_workflows

	/**
	 *
	 * @param {IDMU} idmu
	 */
	constructor(idmu, onUnsuccessfulWorkflows=null) {
		this._running = false
		this._stopped = false
		this.#finished_workflows = []
		this.#idmu = idmu
		this.#onUnsuccessfulWorkflows = onUnsuccessfulWorkflows
	}

	/**
	 *
	 * @returns {boolean}
	 */
	isRunning() {
		return this._running && !this._stopped
	}

	stop() {
		console.debug("UnsendThreadMessagesBatchStrategy stop")
		this._stopped = true
	}

	/**
	 *
	 * @param {number} batchSize
	 * @returns {Promise}
	 */
	run(batchSize) {
		console.debug("UnsendThreadMessagesBatchStrategy.run()", batchSize)
		this._running = true
		this._stopped = false
		return this.#processBatches(batchSize)
	}

	#done() {
		this._running = false
		console.debug("UnsendThreadMessagesBatchStrategy done")
	}

	#unsuccessfulWorkflowAlert() {
		console.debug("UnsendThreadMessagesBatchStrategy unsuccessfulWorkflowAlert")
		if(!this._running) {
			clearInterval(this.interval)
		}
		console.debug("UnsendThreadMessagesBatchStrategy finished_workflows", this.#finished_workflows)
		const unsuccessfulWorkflows = this.#finished_workflows.filter(uiMessage => this.#idmu.window.document.contains(uiMessage.uiComponent.root))
		console.debug("UnsendThreadMessagesBatchStrategy unsuccessfulWorkflows", unsuccessfulWorkflows)
		if(unsuccessfulWorkflows.length >= 1) {
			unsuccessfulWorkflows.forEach(failedWorkflow => this.#finished_workflows.splice(this.#finished_workflows.indexOf(failedWorkflow), 1))
			this.#onUnsuccessfulWorkflows(unsuccessfulWorkflows)
		}
	}

	async #processBatches(batchSize) {
		console.debug("UnsendThreadMessagesBatchStrategy processBatches")
		let done = false
		for(let i = 0; i < batchSize;i++) {
			if(this._stopped) {
				break
			}
			done = await this.#idmu.fetchAndRenderThreadNextMessagePage()
			if(done) {
				break
			} else {
				await new Promise(resolve => setTimeout(resolve, this.#idmu.window.IDMU_NEXT_MESSAGE_PAGE_DELAY))
			}
		}
		try {
			for(const uipiMessage of await this.#idmu.createUIPIMessages()) {
				if(this._stopped) {
					break
				}
				try {
					await uipiMessage.unsend()
					this.#finished_workflows.push(uipiMessage)
					await new Promise(resolve => setTimeout(resolve, this.#idmu.window.IDMU_MESSAGE_QUEUE_DELAY))
				} catch(result) {
					console.error(result)
				}
			}
		} catch(ex) {
			console.error(ex)
		}
		if(!this.interval && this.#onUnsuccessfulWorkflows) {
			this.interval = setInterval(() => this.#unsuccessfulWorkflowAlert(), this.#idmu.window.IDMU_UNSUCESSFUL_WORKFLOW_ALERT_INTERVAL)
		}
		if(done) {
			this.#done()
		} else if(!this._stopped) {
			return this.#processBatches(batchSize)
		}
	}
}
