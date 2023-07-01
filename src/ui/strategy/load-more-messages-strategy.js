/**
 *
 * @param {Element} root
 * @returns {Promise<boolean>}
 */
export default async function loadMoreMessageStrategy(root) {
	let _observer
	const promise = Promise.race([
		new Promise((resolve) => {
			_observer = new MutationObserver((mutations, observer) => {
				if(root.scrollTop !== 0) {
					observer.disconnect()
					resolve(false)
				}
			}).observe(root, { subtree: true, childList:true })
		}),
		new Promise(resolve => setTimeout(() => {
			if(_observer) {
				_observer.disconnect()
			}
			resolve(true)
		}, root.ownerDocument.defaultView.IDMU_SCROLL_DETECTION_TIMEOUT))
	])
	root.scrollTop = 0
	return promise
}
