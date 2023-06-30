const BUTTON_STYLE = {
	"PRIMARY": "primary",
	"SECONDARY": "secondary",
}


export function applyButtonStyle(node, styleName=BUTTON_STYLE.PRIMARY) {
	node.style.zIndex = 9999
	node.style.fontSize = "var(--system-14-font-size)"
	node.style.color = "white"
	node.style.border = "0px"
	node.style.borderRadius = "8px"
	node.style.padding = "8px"
	node.style.fontWeight = "bold"
	node.style.cursor = "pointer"
	node.style.lineHeight = "var(--system-14-line-height)"
	node.style.backgroundColor = `rgb(var(--ig-${styleName}-button))`
	node.addEventListener("mouseover", async () => {
		node.style.backgroundColor = `rgb(var(--ig-${styleName}-button-hover))`
	})
	node.addEventListener("mouseout", async () => {
		node.style.backgroundColor = `rgb(var(--ig-${styleName}-button))`
	})
}
