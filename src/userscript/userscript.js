// This script automates the process of unsending DM's on instagram.com
// This script is meant to be run on the page that lists the message threads
// The workflow works as follow:
// - Create a list of all messages by querying on the [role=listbox] selector
//  - For each message another workflow begins:
//      - Over the message node so that the three dots button appears
//      - Click the three dots button to open the message actions
//      - Click the "Unsend" action button, a modal will open with a dialog that asks user to confirm the intent
//      - Click the "Unsend" button inside the modal
// There is no concurrency, message are unsent one after another by using a queue.

import { createUIElement } from "./ui/ui.js"
import IDMU from "../idmu/idmu.js"

const { uiElement, unsendThreadMessagesButton, loadThreadMessagesButton } = createUIElement()

const idmu = new IDMU(window)

unsendThreadMessagesButton.addEventListener("click", async () => {
	console.log("unsendThreadMessagesButton click")
	try {
		const uipiMessages = idmu.getUIPIMessages()
		console.debug(uipiMessages)
		await idmu.unsendThreadMessages()
	} catch(ex) {
		console.error(ex)
	}
})

loadThreadMessagesButton.addEventListener("click", async () => {
	console.log("loadThreadMessagesButton click")
	try {
		const pagesCount = parseInt(window.prompt("How many pages should we load ? ", 5))
		for(let i =0 ; i < pagesCount;i ++) {
			await idmu.fetchAndRenderThreadNextMessagePage()
		}
		const uipiMessages = idmu.getUIPIMessages()
		console.debug(uipiMessages)
	} catch(ex) {
		console.error(ex)
	}
})


document.body.appendChild(uiElement)
