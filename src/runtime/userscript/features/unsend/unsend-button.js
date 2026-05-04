function UnsendButton() {
	this.root = document.createElement("button")
	this.root.textContent =  "Unsend all DMs"
	applyButtonStyle(this.root, BUTTON_STYLE.PRIMARY)
	this.root.addEventListener("mouseover", () => {
		this.root.style.filter = `brightness(1.15)`
	})
	this.root.addEventListener("mouseout", () => {
		this.root.style.filter = ``
	})
	this.root.addEventListener("click", () => this.onClick())
	this.root.dataTextContent = this.root.textContent
	this.root.dataBackgroundColor = this.root.style.backgroundColor
}

UnsendButton.prototype.onClick = async function() {
	if(this.strategy.isRunning()) {
		console.debug("User asked for messages unsending to stop")
		this.strategy.stop()
		this._onUnsendingFinished()
	} else {
		console.debug("User asked for messages unsending to start")
		;[...this.menuElement.querySelectorAll("button")].filter(button => button !== this.unsendThreadMessagesButton).forEach(button => {
			button.style.visibility = "hidden"
			button.disabled = true
		})
		this.overlayElement.style.display = ""
		this.overlayElement.focus()
		this.unsendThreadMessagesButton.textContent = "Stop processing"
		this.unsendThreadMessagesButton.style.backgroundColor = "#FA383E"
		this.statusElement.style.color = "white"
		this._mutationObserver.disconnect()
		try {
			await this.strategy.run()
		} catch(error) {
			console.error(error)
			if(this.strategy.isRunning()) {
				this.strategy.stop()
			}
			this.statusElement.innerHTML = `<span style="color: red">An error occured, <a href="https://github.com/thoughtsunificator/instagram-dm-unsender/issues/new?template=bug_report.md">please open an issue</a></span>`
		} finally {
			this._onUnsendingFinished()
		}
	}
}


UnsendButton.prototype._onUnsendingFinished = function() {
	console.debug("render onUnsendingFinished")
	;[...this.menuElement.querySelectorAll("button")].filter(button => button !== this.unsendThreadMessagesButton).forEach(button => {
		button.style.visibility = ""
		button.disabled = false
	})
	this.unsendThreadMessagesButton.textContent = this.unsendThreadMessagesButton.dataTextContent
	this.unsendThreadMessagesButton.style.backgroundColor = this.unsendThreadMessagesButton.dataBackgroundColor
	this.overlayElement.style.display = "none"
	this.statusElement.style.color = ""
	this._mutationObserver.observe(this._document.body, { childList: true }) // TODO test
}

const BUTTON_STYLE = {
	"PRIMARY": "primary",
	"SECONDARY": "secondary",
}

/**
 * @param {HTMLButtonElement} buttonElement
 * @param {string}            styleName
 */
function applyButtonStyle(buttonElement, styleName) {
	// TODO reset style
	buttonElement.style.fontSize = "var(--system-14-font-size)"
	buttonElement.style.color = "white"
	buttonElement.style.border = "0px"
	buttonElement.style.borderRadius = "8px"
	buttonElement.style.padding = "8px"
	buttonElement.style.fontWeight = "bold"
	buttonElement.style.cursor = "pointer"
	buttonElement.style.lineHeight = "var(--system-14-line-height)"
	if(styleName) {
		buttonElement.style.backgroundColor = `rgb(var(--ig-${styleName}-button))`
	}
}
