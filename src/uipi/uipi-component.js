export default class UIPIComponent {
	/**
	 *
	 * @param {UIComponent} uiComponent
	 */
	constructor(uiComponent) {
		this._uiComponent = uiComponent
	}

	/**
	 * @readonly
	 * @type {UIComponent}
	 */
	get uiComponent() {
		return this._uiComponent
	}
}
