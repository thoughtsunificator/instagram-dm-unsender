/**
 *
 * @param {Document} document
 * @returns {HTMLDivElement}
 */
export function createMessagesWrapperElement(document) {
	const element = document.createElement("div")
	element.setAttribute("role", "grid")
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
 * @param {boolean} includesUnsend
 * @param {boolean} ignored
 * @returns {HTMLDivElement}
 */
export function createMessageElement(document, text="", includesUnsend=true, ignored=false, eventsTimeout=0) {
	const element = document.createElement("div")
	element.setAttribute("role", "row")
	if(ignored) {
		element.setAttribute("data-idmu-ignore", "true")
	}
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
	const element = document.createElement("div")
	element.setAttribute("role", "row")
	return element
}

/**
 *
 * @param {Document} document
 * @param {boolean} includesUnsend
 * @returns {HTMLDivElement}
 */
export function createMessageActionsMenuElement(document, includesUnsend=true, eventsTimeout) {
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
