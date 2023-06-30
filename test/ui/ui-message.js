import UIStub from "./ui-stub.js"

export default class UIMessageStub extends UIStub {
	registerDefaultActions() {
		this.uiComponent.root.addEventListener("mouseover", () => {
			this.uiComponent.root.ownerDocument.body.innerHTML += `<div aria-describedby><div role><button aria-label=Unsend></button></div></div>`
		})
	}
}
