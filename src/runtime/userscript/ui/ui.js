import { createMenuButtonElement } from "./menu-button.js"
import { createMenuElement } from "./menu.js"
import IDMU from "../../../idmu/idmu.js"
import { UnsendThreadMessagesBatchStrategy } from "../strategy.js"
import { createAlertsWrapperElement } from "./alert.js"
import { createOverlayElement } from "./overlay.js"

/**
 *
 * @param {window} window
 * @returns {HTMLDivElement}    object.uiElement
 * @returns {HTMLButtonElement} object.unsendThreadMessagesButton
 * @returns {HTMLButtonElement} object.loadThreadMessagesButton
 */
export function render(window) {
	console.debug("render")
	const idmu = new IDMU(window)
	const strategy = new UnsendThreadMessagesBatchStrategy(idmu, (unsuccessfulWorkflows) => {
		console.log(unsuccessfulWorkflows)
	})
	const { overlayElement, uiElement, menuElement, unsendThreadMessagesButton, loadThreadMessagesButton } = createUIElement(window.document)
	function onUnsendingFinished() {
		console.debug("render onUnsendingFinished")
		;[...menuElement.querySelectorAll("button")].filter(button => button !== unsendThreadMessagesButton).forEach(button => {
			button.style.visibility = ""
			button.disabled = false
		})
		unsendThreadMessagesButton.textContent = unsendThreadMessagesButton.dataTextContent
		unsendThreadMessagesButton.style.backgroundColor = unsendThreadMessagesButton.dataBackgroundColor
		overlayElement.style.display = "none"
		if(!strategy._stopped) {
			window.alert("IDMU: Finished")
		}
	}
	async function startUnsending() {
		console.debug("User asked for messages unsending to start; UI interaction will be disabled in the meantime")
		;[...menuElement.querySelectorAll("button")].filter(button => button !== unsendThreadMessagesButton).forEach(button => {
			button.style.visibility = "hidden"
			button.disabled = true
		})
		overlayElement.style.display = ""
		overlayElement.focus()
		unsendThreadMessagesButton.textContent = "Stop processing"
		unsendThreadMessagesButton.style.backgroundColor = "#FA383E"
		const batchSize = window.localStorage.getItem("IDMU_BATCH_SIZE") || UnsendThreadMessagesBatchStrategy.DEFAULT_BATCH_SIZE
		await strategy.run(batchSize)
		onUnsendingFinished()
	}
	function handleEvents(event) {
		if(strategy.isRunning()) {
			console.info("User interaction is disabled as the unsending is still running; Please stop the execution first.")
			event.stopImmediatePropagation()
			event.preventDefault()
			event.stopPropagation()
			overlayElement.focus()
			return false
		}
	}
	function onMutations() {
		if(window.location.pathname.startsWith("/direct/t/")) {
			uiElement.style.display = ""
		} else {
			uiElement.style.display = "none"
			strategy.stop()
		}
	}
	window.document.addEventListener("keydown", handleEvents)
	window.document.addEventListener("keyup", handleEvents)
	new MutationObserver(onMutations).observe(window.document.body, { childList: true })
	new MutationObserver(onMutations).observe(window.document.querySelector("[id^=mount] > div > div > div"), { childList: true, attributes: true })
	unsendThreadMessagesButton.dataTextContent = unsendThreadMessagesButton.textContent
	unsendThreadMessagesButton.dataBackgroundColor = unsendThreadMessagesButton.style.backgroundColor
	unsendThreadMessagesButton.addEventListener("click", () => {
		if(strategy.isRunning()) {
			console.debug("User asked for messages unsending to stop")
			strategy.stop()
			onUnsendingFinished()
		} else {
			startUnsending()
		}
	})
	loadThreadMessagesButton.addEventListener("click", () => {
		console.debug("loadThreadMessagesButton click")
		try {
			const batchSize = parseInt(window.prompt("How many pages should we load before each unsending? ", window.localStorage.getItem("IDMU_BATCH_SIZE") || UnsendThreadMessagesBatchStrategy.DEFAULT_BATCH_SIZE ))
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
 * @returns {HTMLDivElement}    object.overlayElement
 * @returns {HTMLDivElement}    object.menuElement
 * @returns {HTMLButtonElement} object.unsendThreadMessagesButton
 * @returns {HTMLButtonElement} object.loadThreadMessagesButton
 */
function createUIElement(document) {
	const uiElement = document.createElement("div")
	const menuElement = createMenuElement(document)
	const overlayElement = createOverlayElement(document)
	const alertsWrapperElement = createAlertsWrapperElement(document)
	const unsendThreadMessagesButton = createMenuButtonElement(document, "Unsend all DMs")
	const loadThreadMessagesButton = createMenuButtonElement(document, "Batch size", "secondary")
	document.body.appendChild(overlayElement)
	document.body.appendChild(alertsWrapperElement)
	menuElement.appendChild(unsendThreadMessagesButton)
	menuElement.appendChild(loadThreadMessagesButton)
	uiElement.appendChild(menuElement)
	return { uiElement, overlayElement, menuElement, unsendThreadMessagesButton, loadThreadMessagesButton }
}
