export default class UIStub {
	/**
	*
	* @param {UIComponent} ui
	*/
	constructor(uiComponent) {
		this.uiComponent = uiComponent
	}
	/**
	 * @abstract
	 */
	registerDefaultActions() {
		throw new Error("registerDefaultActions Not implemented")
	}
}
