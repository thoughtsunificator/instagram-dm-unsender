export default class Message {

	constructor(ui) {
		this.ui = ui
		this.task = null
	}

	async unsend() {
		try {
			await this.ui.showActionsMenu()
			await this.ui.openActionsMenu()
			await this.ui.clickUnsend()
			await this.ui.confirmUnsend()
		} catch(ex) {
			console.error(ex)
		}
	}
}
