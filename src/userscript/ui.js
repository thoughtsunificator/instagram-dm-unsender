import IDMU from "../idmu/idmu.js"

const dmUnsender = new IDMU(window)
dmUnsender.instagram.observe()
console.log("dmUnsender observing...")

const unsendDMButton = document.createElement("button")
unsendDMButton.textContent = "Unsend all DMs"
unsendDMButton.style.top = "10px"
unsendDMButton.style.right = "10px"
applyDefaultStyle(unsendDMButton)
unsendDMButton.addEventListener("click", async () => {
	console.log("dmUnsender button click")
	unsendDMButton.disabled = true
	try {
		await dmUnsender.instagram.ui.uiMessagesWrapper.loadEntireThread()
	} catch(ex) {
		console.error(ex)
	}
	const messages = dmUnsender.getMessages()
	console.debug(messages)
	try {
		await dmUnsender.unsendMessages(messages)
	} catch(ex) {
		console.error(ex)
	}
	unsendDMButton.disabled = false
})
document.body.appendChild(unsendDMButton)

const loadDMsButton = document.createElement("button")
loadDMsButton.textContent = "Load all DMs"
loadDMsButton.style.top = "50px"
loadDMsButton.style.right = "10px"
applyDefaultStyle(loadDMsButton)
loadDMsButton.addEventListener("click", async () => {
	unsendDMButton.disabled = true
	await dmUnsender.instagram.ui.uiMessagesWrapper.loadEntireThread()
	unsendDMButton.disabled = false
})
document.body.appendChild(loadDMsButton)


function applyDefaultStyle(node) {
	node.style.position = "fixed"
	node.style.zIndex = 9999
	node.style.fontSize = "var(--system-14-font-size)"
	node.style.color = "white"
	node.style.border = "0px"
	node.style.borderRadius = "8px"
	node.style.padding = "8px"
	node.style.fontWeight = "bold"
	node.style.cursor = "pointer"
	node.style.lineHeight = "var(--system-14-line-height)"
	node.style.backgroundColor = "rgb(var(--ig-primary-button))"
	node.addEventListener("mouseover", async () => {
		node.style.backgroundColor = "rgb(var(--ig-primary-button-hover))"
	})
	node.addEventListener("mouseout", async () => {
		node.style.backgroundColor = "rgb(var(--ig-primary-button))"
	})
}
