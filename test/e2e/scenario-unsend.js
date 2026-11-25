/**
 * Injected into the replayed page to make unsend flow deterministic.
 * Creates synthetic "sent by me" messages and mocks Instagram's action menu / confirmation dialog.
 */
(() => {
	const doc = document
	const state = { unsent: 0 }

	function makeSentMessage(text, i) {
		const row = doc.createElement("div")
		row.setAttribute("role", "row")
		row.style.minHeight = "48px"
		row.innerHTML = `
      <div role="none" style="justify-content:flex-end;display:flex;width:100%">
        <div role="presentation" style="max-width:60%">
          <div dir="auto"><span>You sent</span><span> ${text} ${i}</span></div>
          <div role="button" aria-haspopup="menu" aria-label="More options for your message" style="width:24px;height:24px">...</div>
        </div>
      </div>`
		row.querySelector('[aria-haspopup="menu"]').addEventListener("click", () => {
			doc.querySelector('[role="menu"][data-idmu-test="1"]')?.remove()
			const menu = doc.createElement("div")
			menu.setAttribute("role", "menu")
			menu.setAttribute("data-idmu-test", "1")
			menu.style.position = "fixed"; menu.style.top = "10px"; menu.style.left = "10px"; menu.style.background = "#fff"; menu.style.zIndex = "9999"
			const item = doc.createElement("div")
			item.setAttribute("role", "menuitem")
			item.textContent = "Unsend"
			item.style.padding = "8px"; item.style.cursor = "pointer"
			item.addEventListener("click", () => {
				menu.remove()
				doc.querySelector('[role="dialog"][data-idmu-test="1"]')?.remove()
				const dialog = doc.createElement("div")
				dialog.setAttribute("role", "dialog")
				dialog.setAttribute("data-idmu-test", "1")
				dialog.style.position = "fixed"; dialog.style.top = "20px"; dialog.style.left = "20px"; dialog.style.background = "#fff"; dialog.style.zIndex = "9999"; dialog.style.padding = "16px"
				const confirm = doc.createElement("button")
				confirm.textContent = "Unsend"
				confirm.addEventListener("click", () => { dialog.remove(); row.remove(); state.unsent++ })
				const cancel = doc.createElement("button")
				cancel.textContent = "Cancel"
				cancel.addEventListener("click", () => dialog.remove())
				dialog.append(confirm, cancel)
				doc.body.append(dialog)
			})
			menu.append(item)
			doc.body.append(menu)
		})
		return row
	}

	function findScrollable(root) {
		for (const c of root.children) {
			const s = getComputedStyle(c)
			if ((s.overflowY === "auto" || s.overflowY === "scroll") && c.scrollHeight >= c.clientHeight) return c
			const r = findScrollable(c)
			if (r) return r
		}
		return null
	}
	function isRow(e) { return [...e.children].some(ch => ch.getAttribute("role") === "none" || ch.getAttribute("role") === "presentation") }
	function getInner(scrollable) {
		let best = scrollable; let bestCount = scrollable.children.length
		const search = (el, d) => {
			if (d > 3) return
			for (const c of el.children) {
				if (isRow(c)) continue
				if (c.children.length > bestCount) { best = c; bestCount = c.children.length }
				search(c, d + 1)
			}
		}
		search(scrollable, 0)
		return best
	}

	let igRoot = doc.querySelector('[data-pagelet="IGDMessagesList"]')
	if (!igRoot) {
		igRoot = doc.createElement("div")
		igRoot.setAttribute("data-pagelet", "IGDMessagesList")
		igRoot.style.height = "500px"
		doc.body.append(igRoot)
	}
	let scrollable = findScrollable(igRoot)
	if (!scrollable) {
		scrollable = doc.createElement("div")
		scrollable.style.overflowY = "auto"
		scrollable.style.height = "500px"
		igRoot.append(scrollable)
	}
	// Ensure it qualifies as scrollable
	if (scrollable.clientHeight === 0) { scrollable.style.height = "500px"; scrollable.style.overflowY = "auto" }
	const inner = getInner(scrollable)
	// Add spacer to ensure scrollable
	if (scrollable.scrollHeight <= scrollable.clientHeight) {
		const sp = doc.createElement("div"); sp.style.height = "900px"; inner.append(sp)
	}
	for (let i = 1; i <= 3; i++) inner.append(makeSentMessage("E2E test message", i))
	window.__idmuE2E = { state, makeSentMessage }
})()
