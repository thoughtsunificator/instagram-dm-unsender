/** @module default-ui Provide a fake instagram UI. */

/**
 *
 * @param {Document} document
 * @returns {HTMLDivElement}
 */
export function createMountElement(document) {
	console.debug("createMountElement", arguments)
	const element = document.createElement("div")
	element.id = "mount_43243"
	element.innerHTML = `
		<div>
			<div>
				<div>
					<div>
					</div>
				</div>
			</div>
		</div>
	`
	return element
}

/**
 *
 * @param {Document} document
 * @param {int} [totalPages=1]
 * @param {int} [itemsPerPage=1]
 * @returns {HTMLDivElement}
 */
export function createMessagesWrapperElement(document, totalPages=0, itemsPerPage=0) {
	console.debug("createMessagesWrapperElement", arguments)
	const element = document.createElement("div")
	element.setAttribute("aria-label", "Conversation with test")
	element.innerHTML = `
		<div>
			<div>
				<div>
					<div id="messageWrapper">
					</div>
				</div>
			</div>
		</div>
	`
	const messageWrapperElement = element.querySelector("#messageWrapper")
	// Simulate scrollable container for findScrollableChild
	messageWrapperElement.style.overflowY = "auto"
	Object.defineProperty(messageWrapperElement, "scrollHeight", { value: 1000, writable: true, configurable: true })
	Object.defineProperty(messageWrapperElement, "clientHeight", { value: 500, writable: true, configurable: true })
	Object.defineProperty(messageWrapperElement, "scrollTop", {
		get() {
			return messageWrapperElement._scrollTop
		},
		set(newValue) {
			messageWrapperElement._scrollTop = newValue
			messageWrapperElement.dispatchEvent(new document.defaultView.Event("scroll"))
		}
	})
	messageWrapperElement.currentPage = 0
	for(let i =0; i < itemsPerPage;i++) {
		const messageElement = createMessageElement.call(null, document, `Item ${i}`)
		messageWrapperElement.append(messageElement)
	}
	messageWrapperElement.addEventListener("scroll", (event) => {
		if(event.target.scrollTop === 0) {
			console.debug("scroll event")
			const hasNextPage = event.target.currentPage + 1 <= totalPages
			console.debug("hasNextPage", hasNextPage, event.target.currentPage, totalPages)
			if(hasNextPage) {
				const progressBar = document.createElement("div")
				progressBar.setAttribute("role", "progressbar")
				event.target.appendChild(progressBar)
				const hasMorePages = event.target.currentPage + 2 <= totalPages
				console.debug("hasMorePages", hasMorePages)
				if(hasMorePages) {
					event.target.scrollTop = 5
				}
				console.debug("messageWrapperElement loading page", event.target.currentPage)
				console.debug("event.target.children.length", event.target.children.length)
				for(let i =0; i < itemsPerPage;i++) {
					const messageElement = createMessageElement.call(null, document, `Item ${i}`)
					messageWrapperElement.append(messageElement)
				}
				progressBar.remove()
				event.target.currentPage++
			}
		}
	})
	return element
}

/**
 * Creates a fake message element that mirrors Instagram's real DOM structure.
 *
 * Real IG structure (simplified):
 *   <div> ← message row (no role attr in current IG)
 *     <div role="none" style="justify-content: flex-end"> ← sent indicator
 *       <div role="presentation">
 *         <span>message text</span>
 *       </div>
 *     </div>
 *   </div>
 *
 * On hover, IG adds an action button wrapped in role=button with aria-haspopup=menu,
 * containing an SVG with aria-label="See more options for message from ..."
 *
 * @param {Document} document
 * @param {string} [text=""]
 * @param {boolean} [includesUnsend=true]
 * @param {boolean} [ignored=false]
 * @param {number} [eventsTimeout=0]
 * @returns {HTMLDivElement}
 */
export function createMessageElement(document, text="", includesUnsend=true, ignored=false, eventsTimeout=0) {
	console.debug("createMessageElement", arguments)
	const element = document.createElement("div")
	if(ignored) {
		element.setAttribute("data-idmu-ignore", "true")
	}
	// Reflect real IG structure: role=none wrapper with flex-end for sent messages,
	// and role=presentation for the message content container
	const flexStyle = includesUnsend ? " style=\"justify-content: flex-end\"" : ""
	element.innerHTML = `<div role="none"${flexStyle}><div role="presentation">${includesUnsend?"<span>You sent</span>":""}<span>${text}</span></div></div>`
	element.addEventListener("mouseover", () => {
		console.debug(`message ${text} mouseover`)
		setTimeout(() => {
			if (element.querySelector("[aria-label]")) return // already shown
			// Create action button matching real IG structure:
			// <div role="button" aria-haspopup="menu" tabindex="0">
			//   <svg role="img" aria-label="See more options for message from foo">
			const actionBtnWrapper = element.ownerDocument.createElement("div")
			actionBtnWrapper.setAttribute("role", "button")
			actionBtnWrapper.setAttribute("aria-haspopup", "menu")
			actionBtnWrapper.setAttribute("tabindex", "0")
			const svgEl = element.ownerDocument.createElement("svg")
			svgEl.setAttribute("role", "img")
			svgEl.setAttribute("aria-label", "See more options for message from foo")
			actionBtnWrapper.appendChild(svgEl)
			element.appendChild(actionBtnWrapper)
			actionBtnWrapper.addEventListener("click", () => {
				console.debug(`actionButton clicked`)
				setTimeout(() => {
					if(element.messageActionsMenuElement) {
						element.messageActionsMenuElement.remove()
						delete element.messageActionsMenuElement
					} else {
						const messageActionsMenuElement = createMessageActionsMenuElement(document, includesUnsend, eventsTimeout)
						messageActionsMenuElement.messageElement = element
						element.messageActionsMenuElement = messageActionsMenuElement
						element.ownerDocument.body.appendChild(messageActionsMenuElement)
					}
				}, eventsTimeout)
			})
		})
	})
	element.addEventListener("mouseout", () => {
		const actionBtn = element.querySelector("[role=button][aria-haspopup=menu]")
		if(actionBtn) {
			actionBtn.remove()
		}
	})
	return element
}

/**
 *
 * @param {Document} document
 * @returns {HTMLDivElement}
 */
export function createDummyMessageElement(document) {
	console.debug("createDummyMessageElement", arguments)
	const element = document.createElement("div")
	return element
}

/**
 * Creates a fake actions menu matching real IG structure.
 *
 * Real IG structure:
 *   <div role="dialog">
 *     <div role="menu">
 *       <div role="menuitem">Bar</div>
 *       <div role="menuitem">Foo</div>
 *       <div role="menuitem">Unsend</div>  ← text node child
 *     </div>
 *   </div>
 *
 * @param {Document} document
 * @param {boolean} [includesUnsend=true]
 * @returns {HTMLDivElement}
 */
export function createMessageActionsMenuElement(document, includesUnsend=true) {
	console.debug("createMessageActionsMenuElement", arguments)
	const element = document.createElement("div")
	element.setAttribute("role", "dialog")
	const menuElement = document.createElement("div")
	menuElement.id = "menu"
	menuElement.setAttribute("role", "menu")
	const menuItem1 = document.createElement("div")
	menuItem1.setAttribute("role", "menuitem")
	menuItem1.textContent = "Bar"
	const menuItem2 = document.createElement("div")
	menuItem2.setAttribute("role", "menuitem")
	menuItem2.textContent = "Foo"
	menuElement.appendChild(menuItem1)
	menuElement.appendChild(menuItem2)
	element.appendChild(menuElement)
	if(includesUnsend) {
		const unsendElement = document.createElement("div")
		unsendElement.setAttribute("role", "menuitem")
		unsendElement.textContent = "Unsend"
		unsendElement.id = "unsend"
		menuElement.appendChild(unsendElement)
		element.querySelector("#unsend").addEventListener("click", () => {
			console.debug("#unsend button clicked")
			const confirmElement = document.createElement("div")
			confirmElement.setAttribute("role", "dialog")
			const confirmUnsend = document.createElement("button")
			confirmUnsend.id = "confirmUnsend"
			confirmElement.appendChild(confirmUnsend)
			const cancelUnsend = document.createElement("button")
			cancelUnsend.id = "cancelUnsend"
			confirmElement.appendChild(cancelUnsend)
			menuElement.replaceWith(confirmElement)
			console.debug("Creating htmlConfirm modal and setting listener")
			element.querySelector("#confirmUnsend").addEventListener("click", () => {
				console.debug("#confirmUnsend clicked")
				element.messageElement.remove()
				element.remove()
			})
		})
	}
	return element
}
