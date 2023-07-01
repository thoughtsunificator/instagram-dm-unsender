export default class UIComponent {
	/**
	 *
	 * @param {Element} root
	 * @param {object} identifier
	 */
	constructor(root, identifier={}) {
		this.root = root
		this.identifier = identifier
	}
}
