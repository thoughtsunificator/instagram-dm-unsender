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
import IDMU from "../../idmu/idmu.js"
import Queue from "../queue.js"
import { UIPIMessageUnsendTask } from "../task.js"

const { uiElement, unsendThreadMessagesButton, loadThreadMessagesButton } = createUIElement()

const idmu = new IDMU(window)

async function batchLoadStrategy(batchSize=1) {
	console.debug("batchLoadStrategy", batchSize)
	for(let i =0; i < batchSize;i++) {
		await unsendThreadMessages()
		await idmu.fetchAndRenderThreadNextMessagePage()
	}
	alert("IDMU: Finished")
}

async function unsendThreadMessages() {
	try {
		const queue = new Queue()
		for(const uipiMessage of await idmu.createUIPIMessages()) {
			queue.add(new UIPIMessageUnsendTask(queue.length + 1, uipiMessage))
		}
		for(const item of queue.items.slice()) {
			try {
				await item.promise()
				console.debug(`Completed Task ${item.task.id} will continue again in ${window.IDMU_MESSAGE_QUEUE_DELAY}ms`)
				await new Promise(resolve => setTimeout(resolve, window.IDMU_MESSAGE_QUEUE_DELAY))
			} catch(result) {
				console.error(result)
			}
		}
	} catch(ex) {
		console.error(ex)
	}
}


unsendThreadMessagesButton.addEventListener("click", async () => {
	console.log("unsendThreadMessagesButton click")
	batchLoadStrategy(localStorage.getItem("IDMU_BATCH_SIZE") || 1)
})

loadThreadMessagesButton.addEventListener("click", async () => {
	console.log("loadThreadMessagesButton click")
	try {
		const batchSize = parseInt(window.prompt("How many pages should we load ? ", localStorage.getItem("IDMU_BATCH_SIZE") || 5 ))
		if(parseInt(batchSize)) {
			localStorage.setItem("IDMU_BATCH_SIZE", parseInt(batchSize))
		}
		console.debug(`Setting IDMU_BATCH_SIZE to ${batchSize}`)
	} catch(ex) {
		console.error(ex)
	}
})


document.body.appendChild(uiElement)
