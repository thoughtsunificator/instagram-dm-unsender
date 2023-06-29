import IDMU from "../idmu/idmu.js"

const dmUnsender = new IDMU(window)
dmUnsender.instagram.observe()
console.log("dmUnsender observing...")

const button = document.createElement("button")
button.textContent = "Unsend all DMs"
button.style.position = "fixed"
button.style.top = "10px"
button.style.right = "10px"
button.style.zIndex = 9999
button.style.fontSize = "var(--system-14-font-size)"
button.style.color = "white"
button.style.border = "0px"
button.style.borderRadius = "8px"
button.style.padding = "8px"
button.style.fontWeight = "bold"
button.style.cursor = "pointer"
button.style.lineHeight = "var(--system-14-line-height)"
button.style.backgroundColor = "rgb(var(--ig-primary-button))"
button.addEventListener("click", async () => {
	console.log("dmUnsender button click")
	button.disabled = true
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
	button.disabled = false
})
button.addEventListener("mouseover", async () => {
	button.style.backgroundColor = "rgb(var(--ig-primary-button-hover))"
})
button.addEventListener("mouseout", async () => {
	button.style.backgroundColor = "rgb(var(--ig-primary-button))"
})
document.body.appendChild(button)
