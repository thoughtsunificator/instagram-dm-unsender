export function createMenuElement() {
	const menuElement = document.createElement("div")
	menuElement.style.top = "20px"
	menuElement.style.right = "430px"
	menuElement.style.position = "fixed"
	menuElement.style.display = "flex"
	menuElement.style.gap = "10px"
	return menuElement
}
