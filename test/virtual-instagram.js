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
 * @param {object[]} [pages=[]]
 * @returns {HTMLDivElement}
 */
export function createMessagesWrapperElement(document, pages=[]) {
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
	messageWrapperElement.scrollIntoView = () => {}
	messageWrapperElement.currentPage = 0
	messageWrapperElement.addEventListener("scroll", (event) => {
		if(event.target.scrollTop === 0) {
			const page = pages.find(page => page.page === event.target.currentPage)
			if(page) {
				event.target.innerHTML += `<div role="progressbar"></div>`
				setTimeout(() => {
					if(pages.find(nextPage => nextPage.page === event.target.currentPage + 1)) {
						event.target.scrollTop = 5
					}
					console.debug("messageWrapperElement loading page", page)
					page.items.forEach(item => event.target.append(item))
					event.target.querySelector("[role=progressbar]").remove()
				})
				event.target.currentPage++
			}
		}
	})
	return element
}

/**
 *
 * @param {Document} document
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
	element.scrollIntoView = () => {}
	element.innerHTML = `<span>${text}</span>`
	element.addEventListener("mouseover", event => {
		setTimeout(() => {
			const moreElement = event.target.ownerDocument.createElement("div")
			moreElement.setAttribute("aria-label", "More")
			moreElement.addEventListener("click", () => {
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
			event.target.appendChild(moreElement)
		})
	})
	element.addEventListener("mouseout", () => {
		setTimeout(() => {
			if(element.querySelector("[aria-label]")) {
				element.querySelector("[aria-label]").remove()
			}
		}	,eventsTimeout)
	})
	return element
}

/**
 *
 * @param {Document} document
 * @returns {HTMLDivElement}
 */
export function createDummyMessage(document) {
	console.debug("createDummyMessage", arguments)
	const element = document.createElement("div")
	element.setAttribute("role", "row")
	return element
}

/**
 *
 * @param {Document} document
 * @param {boolean} [includesUnsend=true]
 * @param {number}  [eventsTimeout=0]
 * @returns {HTMLDivElement}
 */
export function createMessageActionsMenuElement(document, includesUnsend=true, eventsTimeout) {
	console.debug("createMessageActionsMenuElement", arguments)
	const element = document.createElement("div")
	element.setAttribute("role", "dialog")
	const htmlMenu = `<div role="menu">
				<div role=""><div role="menuitem">Bar</div></div>
				<div role=""><div role="me-1 nuitem">Foo</div></div>
				${includesUnsend ? `<div role=""><div id="unsend" role="menuitem">Unsend</div></div>` : ``}
			</div>`
	const htmlConfirm = `<div><button id="confirmUnsend"></button><button id="cancelUnsend"></button></div>`
	;(function toggleHTML() {
		element.innerHTML = htmlMenu
	})()
	if(includesUnsend) {
		element.querySelector("#unsend").addEventListener("click", () => {
			setTimeout(() => {
				element.innerHTML = htmlConfirm
				element.querySelector("#confirmUnsend").addEventListener("click", () => {
					setTimeout(() => {
						if(!document.defaultView.FAKE_FAIL_UNSEND) {
							element.messageElement.remove()
						}
						element.remove()
					}, eventsTimeout)
				})
			}, eventsTimeout)
		})
	}
	return element
}
