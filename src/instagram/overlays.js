export { dismissStaleOverlays, dismissOverlays }

/**
 * @param {string|null} text
 * @returns {boolean}
 */
function looksLikeCancel(text) {
	const normalized = (text ?? "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase()
	return ["cancel", "annuler", "annulla", "abbrechen", "cancelar", "anuluj", "iptal", "취소", "キャンセル", "取消", "close", "fermer", "chiudi"]
		.some(label => normalized === label || normalized.includes(label))
}

/**
 * Closes whatever dialog or dropdown is left open by a previous (possibly failed) action.
 * Prefers Escape to avoid accidentally confirming a destructive dialog.
 *
 * @param {Document} document
 */
function dismissStaleOverlays(document) {
	const staleDialog = document.querySelector("[role=dialog]")
	if(staleDialog) {
		console.debug("[idmu] Dismissing stale dialog via Escape")
		pressEscape(document)
		// If Escape did not close it, click a cancel/close-looking button rather than the first button.
		if(document.querySelector("[role=dialog]")) {
			const dialog = document.querySelector("[role=dialog]")
			const buttons = [...(dialog?.querySelectorAll("button, [role=button]") || [])]
			const cancel = buttons.find(btn => looksLikeCancel(btn.textContent))
			if(cancel) {
				console.debug("[idmu] Dismissing stale dialog via cancel button")
				cancel.click()
			} else {
				console.debug("[idmu] Stale dialog remains; leaving it to avoid accidental confirm")
			}
		}
	}
	if(document.querySelector("[role=menu], [role=listbox]")) {
		console.debug("[idmu] Dismissing stale menu via Escape")
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
	// Last resort: if still open, try a cancel-looking button, never a confirm-looking first button.
	const dialog = document.querySelector("[role=dialog]")
	const buttons = [...(dialog?.querySelectorAll("button, [role=button]") || [])]
	const cancel = buttons.find(btn => looksLikeCancel(btn.textContent))
	if(cancel) {
		cancel.click()
		await wait(200)
	}
}

/**
 * @param {Document} document
 */
function pressEscape(document) {
	document.body.dispatchEvent(new document.defaultView.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
	document.body.dispatchEvent(new document.defaultView.KeyboardEvent("keyup", { key: "Escape", bubbles: true }))
}
