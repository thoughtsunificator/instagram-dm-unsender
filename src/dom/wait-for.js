export default function(target, test, removed=false, timeout=500) {
	return new Promise((resolve, reject) => {
		let _observer
		let timeoutId
		if(timeout) {
			timeoutId = setTimeout(() => {
				if(_observer) {
					_observer.disconnect()
				}
				reject(`waitFor timed out before finding its target (${timeout}ms)`)
			}, timeout)
		}
		new MutationObserver((mutations, observer) => {
			_observer = observer
			for(const mutation of mutations) {
				const nodes = removed ? mutation.removedNodes : mutation.addedNodes
				for(const node of [...nodes]) {
					const testNode = test(node)
					if(testNode) {
						clearTimeout(timeoutId)
						resolve(testNode)
					}
				}
			}
		}).observe(target, { subtree: true, childList:true })
		const treeWalker = target.ownerDocument.createTreeWalker(
			target,
			NodeFilter.SHOW_ELEMENT
		)
		while(treeWalker.nextNode()) {
			const testNode = test(treeWalker.currentNode)
			if(testNode) {
				clearTimeout(timeoutId)
				if(_observer) {
					_observer.disconnect()
				}
				resolve(testNode)
				break
			}
		}
	})

}
