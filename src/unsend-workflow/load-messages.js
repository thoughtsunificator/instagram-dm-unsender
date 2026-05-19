export { LoadMessages }

/**
 * Ensure all messages are loaded
 * as if the user scrolled to load
 * its entire chat history
 *
 * @param {ThreadPage}
 */
function LoadMessages(page) {
	Workflow.prototype.constructor.call(this)
	this.page = page
}
LoadMessages.prototype = Object.create(Workflow.prototype)
LoadMessages.prototype.constructor = LoadMessages

LoadMessages.prototype.run = async function() {
	await this.withBackoff(page.loadMessages)
}

