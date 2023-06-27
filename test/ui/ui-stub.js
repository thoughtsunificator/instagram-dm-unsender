export default class UIStub {
	/**
	*
	* @param {UIComponent} ui
	*/
	constructor(ui) {
		this.ui = ui
	}
	/**
	 * @abstract
	 */
	registerDefaultActions() {
		throw new Error("registerDefaultActions Not implemented")
	}
}
