export default class UIPIComponent {
	constructor(uiComponent) {
		this._uiComponent = uiComponent
	}
	get uiComponent() {
		return this._uiComponent
	}
}
