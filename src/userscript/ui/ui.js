import { createMenuButtonElement } from "./menu-button.js"
import { createMenuElement } from "./menu.js"


export function createUIElement() {
	const uiElement = document.createElement("div")
	const menuElement = createMenuElement()

	const unsendThreadMessagesButton = createMenuButtonElement("Unsend all DMs")
	const loadThreadMessagesButton = createMenuButtonElement("Load DMs", "secondary")


	menuElement.appendChild(unsendThreadMessagesButton)
	menuElement.appendChild(loadThreadMessagesButton)

	uiElement.appendChild(menuElement)
	return { uiElement, menuElement, unsendThreadMessagesButton, loadThreadMessagesButton }
}
