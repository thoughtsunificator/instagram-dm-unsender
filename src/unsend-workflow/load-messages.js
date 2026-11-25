import { Workflow } from "../workflow/workflow.js"
import { t } from "../i18n/i18n.js"

export { LoadMessages }

/**
 * Loads the whole history of a conversation, page after page, as if the user scrolled up to the very first message.
 *
 * @param {MessagesWrapper} messagesWrapper
 * @param {AbortController} [abortController]
 */
function LoadMessages(messagesWrapper, abortController) {
	Workflow.call(this, abortController)
	this.messagesWrapper = messagesWrapper
}
LoadMessages.prototype = Object.create(Workflow.prototype)
LoadMessages.prototype.constructor = LoadMessages

/**
 * @returns {Promise<number>} number of pages loaded
 */
LoadMessages.prototype.run = async function() {
	let pages = 0
	for(;;) {
		this.throwIfAborted()
		this.setStatus(t("workflow.loadingNextPage"))
		const done = await this.withBackoff(() => this.messagesWrapper.loadMore(this.abortController), { retries: 2, baseMs: 2000 })
		if(done) {
			this.setStatus(t("workflow.allPagesLoaded", { pages }))
			return pages
		}
		pages++
		this.metrics.count("pageLoaded")
	}
}
