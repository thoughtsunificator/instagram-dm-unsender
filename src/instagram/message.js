import { MessageUnsendTask } from "../idmu/task.js"


class FailedWorkflowException extends Error {}

export default class Message {

	constructor(ui) {
		this._ui = ui
		this._task = null
	}

	get ui() {
		return this._ui
	}

	get task() {
		return this._task
	}

	async unsend() {
		try {
			await this.ui.showActionsMenu()
			await this.ui.openActionsMenu()
			await this.ui.clickUnsend()
			await this.ui.confirmUnsend()
		} catch(ex) {
			console.error(ex)
			throw FailedWorkflowException({ error: "Failed to execute workflow for this message", task: this.task })
		}
	}

	createTask(id) {
		this._task = new MessageUnsendTask(id, this)
		return this.task
	}

}
