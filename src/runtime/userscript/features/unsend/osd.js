import { UnsendButton } from "./unsend-button.js"
import { Menu } from "./menu.js"
import { Overlay } from "./overlay.js"

export { OSD }

function OSD() {
	// Status
	// Menu=>Button
	// Overlay
}


/**
 * @param {window} window
 * @returns {OSD}
 */
OSD.prototype.render = function(target) {
	target.appendChild(ui.root)
}

