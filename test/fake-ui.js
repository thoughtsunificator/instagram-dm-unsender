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
	element.setAttribute("role", "grid")
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
	element.setAttribute("role", "row")
	if(ignored) {
		element.setAttribute("data-idmu-ignore", "true")
	}
	element.innerHTML = `${includesUnsend?"<span>You sent</span>":""}<span>${text}</span>`
	element.addEventListener("mouseover", event => {
		console.debug(`message ${text} mouseover`)
		setTimeout(() => {
			const moreElement = event.target.ownerDocument.createElement("div")
			moreElement.setAttribute("aria-label", "See more options for message from foo")
			event.target.appendChild(moreElement)
			event.target.addEventListener("click", () => { // Listen for event of parent instead of moreElement because instagram use a svg Element
				console.debug(`moreElement clicked`)
				setTimeout(() => {
					if(event.target.messageActionsMenuElement) {
						event.target.messageActionsMenuElement.remove()
						delete event.target.messageActionsMenuElement
					} else {
						const messageActionsMenuElement = createMessageActionsMenuElement(document, includesUnsend, eventsTimeout)
						messageActionsMenuElement.messageElement = event.target
						event.target.messageActionsMenuElement = messageActionsMenuElement
						event.target.ownerDocument.body.appendChild(messageActionsMenuElement)
					}
				}, eventsTimeout)
			})
		})
	})
	element.addEventListener("mouseout", () => {
		if(element.querySelector("[aria-label]")) {
			element.querySelector("[aria-label]").remove()
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
	element.setAttribute("role", "row")
	return element
}

/**
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
	menuItem1.setAttribute("role", "")
	const barElement = document.createElement("div")
	barElement.setAttribute("role", "menuitem")
	barElement.textContent = "Bar"
	menuItem1.appendChild(barElement)
	const menuItem2 = document.createElement("div")
	menuItem2.setAttribute("role", "")
	const fooElement = document.createElement("div")
	fooElement.setAttribute("role", "menuitem")
	fooElement.textContent = "Foo"
	menuItem2.appendChild(fooElement)
	menuElement.appendChild(menuItem1)
	menuElement.appendChild(menuItem2)
	element.appendChild(menuElement)
	if(includesUnsend) {
		const menuItem3 = document.createElement("div")
		menuItem3.setAttribute("role", "")
		const unsendElement = document.createElement("div")
		unsendElement.setAttribute("role", "menuitem")
		unsendElement.textContent = "Unsend"
		unsendElement.id = "unsend"
		menuItem3.appendChild(unsendElement)
		menuElement.appendChild(menuItem3)
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

