export { dismissStaleOverlays, dismissOverlays }

/**
 * Closes whatever dialog or dropdown is left open by a previous (possibly failed) action.
 * Dialogs are closed by clicking their first button, menus by emulating Escape.
 *
 * @param {Document} document
 */
function dismissStaleOverlays(document) {
	const staleDialog = document.querySelector("[role=dialog]")
	if(staleDialog) {
		console.debug("Dismissing stale dialog")
		const closeButton = staleDialog.querySelector("button")
		if(closeButton) {
			closeButton.click()
		}
	}
	if(document.querySelector("[role=menu], [role=listbox]")) {
		console.debug("Dismissing stale menu via Escape")
		pressEscape(document)
	}
}

/**
 * Used after a failed unsend: presses Escape until no dialog is left open (max 2 presses)
 *
 * @param {Document} document
 * @param {function(number): Promise<void>} wait - Resolves after the given milliseconds
 * @returns {Promise<void>}
 */
async function dismissOverlays(document, wait) {
	for(let press = 0; press < 2; press++) {
		pressEscape(document)
		await wait(200)
		if(document.querySelector("[role=dialog]") === null) {
			return
		}
	}
}

/**
 * @param {Document} document
 */
function pressEscape(document) {
	document.body.dispatchEvent(new document.defaultView.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
}
