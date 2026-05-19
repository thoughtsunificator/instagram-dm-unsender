import { Page } "../page.js"

export { InstagramPage }

function InstagramPage(pageDocument) {
	Page.prototype.constructor.call(this, pageDocument)
}
InstagramPage.prototype = Object.create(Page.prototype)
InstagramPage.prototype.constructor = InstagramPage
