export { Overlay }

/**
 * @param {Document} document
 * @returns {HTMLDivElement}
 */
function Overlay(document) {
	this.root = document.createElement("div")
	this.root.id = "idmu-overlay"
	this.root.tabIndex = 0
	this.root.style.top = "0"
	this.root.style.right = "0"
	this.root.style.position = "fixed"
	this.root.style.width = "100vw"
	this.root.style.height = "100vh"
	this.root.style.zIndex = "998"
	this.root.style.backgroundColor = "#000000d6"
	this.root.style.display = "none"
	osd.listen("userInteractionPrevented", () => {
		this.root.focus()
	})
}
