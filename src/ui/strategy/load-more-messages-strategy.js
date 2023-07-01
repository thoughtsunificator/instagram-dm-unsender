export default async function loadMoreMessageStrategy(uiComponent) {
	uiComponent.root.scrollTop = 0
	await new Promise((resolve) => {
		new MutationObserver((mutations, observer) => {
			if(uiComponent.root.scrollTop !== 0) {
				observer.disconnect()
				resolve(false)
			}
		}).observe(uiComponent.root.ownerDocument.body, { subtree: true, childList:true })
	})
}
