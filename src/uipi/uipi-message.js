import { Task } from "../idmu/task.js"

import UIPIComponent from "./uipi-component.js"


class FailedWorkflowException extends Error {}

export default class UIPIMessage extends UIPIComponent {

	#task

	constructor(uiComponent) {
		super(uiComponent)
		this.#task = null
	}

	async unsend() {
		try {
			await this.uiComponent.showActionsMenuButton()
			await this.uiComponent.openActionsMenu()
			await this.uiComponent.clickUnsend()
			await this.uiComponent.confirmUnsend()
			return true
		} catch(ex) {
			console.error(ex)
			this.uiComponent.hideActionMenuButton()
			this.uiComponent.closeActionMenuButton()
			throw FailedWorkflowException({ error: "Failed to execute workflow for this message", task: this.#task })
		}
	}

	createTask(id) {
		this.#task = new UIPIMessageUnsendTask(id, this)
		return this.#task
	}

}

export class UIPIMessageUnsendTask extends Task {
	/**
	 *
	 * @param {data} message
	 */
	constructor(id, message) {
		super(id)
		this.message = message
		this.runCount = 0
	}
	run() {
		const unsend = this.message.unsend()
		this.runCount++
		return unsend
	}
	stop() {
	}
}
