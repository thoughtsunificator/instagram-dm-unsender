import { createMenuButtonElement } from "./menu-button.js"
import { createMenuElement } from "./menu.js"
import IDMU from "../../../idmu/idmu.js"
import { UnsendThreadMessagesBatchStrategy } from "../strategy.js"
import { createAlertsWrapperElement } from "./alert.js"

/**
 *
 * @param {window} window
 * @returns {HTMLDivElement}    object.uiElement
 * @returns {HTMLButtonElement} object.unsendThreadMessagesButton
 * @returns {HTMLButtonElement} object.loadThreadMessagesButton
 */
export function render(window) {
	const idmu = new IDMU(window)
	const strategy = new UnsendThreadMessagesBatchStrategy(idmu, (unsuccessfulWorkflows) => {
		console.log(unsuccessfulWorkflows)
	})
	const { uiElement, unsendThreadMessagesButton, loadThreadMessagesButton } = createUIElement(window.document)
	unsendThreadMessagesButton.dataTextContent = unsendThreadMessagesButton.textContent
	unsendThreadMessagesButton.dataBackgroundColor = unsendThreadMessagesButton.style.backgroundColor
	unsendThreadMessagesButton.addEventListener("click", async () => {
		if(strategy.isRunning()) {
			console.debug("User asked to stop messages unsending")
			strategy.stop()
			unsendThreadMessagesButton.textContent = unsendThreadMessagesButton.dataTextContent
			unsendThreadMessagesButton.style.backgroundColor = unsendThreadMessagesButton.dataBackgroundColor
		} else {
			console.debug("User asked to start messages unsending")
			unsendThreadMessagesButton.textContent = "Stop processing"
			unsendThreadMessagesButton.style.backgroundColor = "#FA383E"
			const batchSize = window.localStorage.getItem("IDMU_BATCH_SIZE") || UnsendThreadMessagesBatchStrategy.DEFAULT_BATCH_SIZE
			await strategy.run(batchSize)
			unsendThreadMessagesButton.textContent = unsendThreadMessagesButton.dataTextContent
			unsendThreadMessagesButton.style.backgroundColor = unsendThreadMessagesButton.dataBackgroundColor
			if(!strategy._stopped) {
				window.alert("IDMU: Finished")
			}
		}
	})
	loadThreadMessagesButton.addEventListener("click", async () => {
		console.debug("loadThreadMessagesButton click")
		try {
			const batchSize = parseInt(window.prompt("How many pages should we load ? ", window.localStorage.getItem("IDMU_BATCH_SIZE") || UnsendThreadMessagesBatchStrategy.DEFAULT_BATCH_SIZE ))
			if(parseInt(batchSize)) {
				window.localStorage.setItem("IDMU_BATCH_SIZE", parseInt(batchSize))
			}
			console.debug(`Setting IDMU_BATCH_SIZE to ${batchSize}`)
		} catch(ex) {
			console.error(ex)
		}
	})
	window.document.body.appendChild(uiElement)
	return { uiElement, unsendThreadMessagesButton, loadThreadMessagesButton }
}

/**
 *
 * @param   {Document}          document
 * @returns {object}
 * @returns {HTMLDivElement}    object.uiElement
 * @returns {HTMLDivElement}    object.menuElement
 * @returns {HTMLButtonElement} object.unsendThreadMessagesButton
 * @returns {HTMLButtonElement} object.loadThreadMessagesButton
 */
function createUIElement(document) {
	const uiElement = document.createElement("div")
	const menuElement = createMenuElement(document)
	const alertsWrapperElement = createAlertsWrapperElement(document)
	const unsendThreadMessagesButton = createMenuButtonElement(document, "Unsend all DMs")
	const loadThreadMessagesButton = createMenuButtonElement(document, "Batch size", "secondary")
	document.body.appendChild(alertsWrapperElement)
	menuElement.appendChild(unsendThreadMessagesButton)
	menuElement.appendChild(loadThreadMessagesButton)
	uiElement.appendChild(menuElement)
	return { uiElement, menuElement, unsendThreadMessagesButton, loadThreadMessagesButton }
}
