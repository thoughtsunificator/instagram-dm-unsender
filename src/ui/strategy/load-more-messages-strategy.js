import waitFor from "../../dom/wait-for.js"

export default async function loadMoreMessageStrategy(uiComponent) {
	uiComponent.root.scrollTop = 0
	try {
		await waitFor(uiComponent.root.ownerDocument.body, node => {
			if(node.nodeType === Node.ELEMENT_NODE && uiComponent.root.contains(node) && uiComponent.root.scrollTop !== 0) {
				return node
			}
		}, false, 10000)
		if(uiComponent.root.scrollTop !== 0) {
			await new Promise(resolve => setTimeout(resolve, 2000))
		}
	} catch(ex) {
		console.error(ex)
	}
}
