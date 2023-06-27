import UIStub from "./ui-stub.js"

export default class UIMessageStub extends UIStub {
	registerDefaultActions() {
		this.ui.root.addEventListener("mouseover", () => {
			this.ui.root.ownerDocument.body.innerHTML += `<div aria-describedby><div role><button aria-label=Unsend></button></div></div>`
		})
	}
}
