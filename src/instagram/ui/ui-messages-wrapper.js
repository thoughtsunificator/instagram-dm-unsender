import UIComponent from "./ui-component.js"
import waitFor from "../../dom/wait-for.js"

export default class UIMessagesWrapper extends UIComponent {

	constructor(root) {
		super(root)
	}

	#isLoader(node) {
		if(node.nodeType === Node.ELEMENT_NODE) {
			return node
		}
	}

	async loadEntireThread() {
		console.debug("loadEntireThread")
		this.root.scrollTop = 0
		try {
			await waitFor(this.root.ownerDocument.body, node => this.#isLoader(node), true, 2000)
			if(this.root.scrollTop !== 0) {
				this.loadEntireThread()
			}
		} catch(ex) {
			console.error(ex)
		}
	}

}
