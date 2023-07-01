/**
 *
 * @param {Element} target
 * @param {function} getElement
 * @returns {Promise<Element>}
 */
export async function waitForElement(target, getElement) {
	return new Promise((resolve) => {
		let element = getElement()
		if(element) {
			resolve(element)
		} else {
			new MutationObserver((mutations, observer) => {
				element = getElement()
				if(element) {
					observer.disconnect()
					resolve(element)
				}
			}).observe(target, { subtree: true, childList:true })
		}
	})
}
