/** @module changelog-panel The "What's new" panel: the changes of each version, from CHANGELOG.md */

import { t } from "../../../../i18n/i18n.js"

export { createChangelogPanel }

/**
 * @param {Document} document
 * @param {{ version: string, date: string, items: string[] }[]} entries
 * @returns {{ root: HTMLDivElement, isVisible: () => boolean, toggle: () => void }}
 */
function createChangelogPanel(document, entries) {
	const root = document.createElement("div")
	root.id = "idmu-changelog"
	root.style.position = "fixed"
	root.style.top = "60px"
	root.style.right = "430px"
	root.style.zIndex = "999"
	root.style.width = "360px"
	root.style.maxHeight = "60vh"
	root.style.overflowY = "auto"
	root.style.padding = "16px"
	root.style.borderRadius = "12px"
	root.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.3)"
	root.style.background = "var(--ig-elevated-background, #262626)"
	root.style.color = "var(--ig-primary-text, #f5f5f5)"
	root.style.fontSize = "var(--system-14-font-size, 14px)"
	root.style.display = "none"

	const header = document.createElement("div")
	header.style.display = "flex"
	header.style.justifyContent = "space-between"
	header.style.alignItems = "center"
	header.style.marginBottom = "8px"
	const title = document.createElement("strong")
	title.textContent = t("ui.whatsNew")
	const close = document.createElement("button")
	close.textContent = t("ui.close")
	close.style.cursor = "pointer"
	close.addEventListener("click", () => hide())
	header.append(title, close)
	root.append(header)

	if(entries.length === 0) {
		const empty = document.createElement("div")
		empty.textContent = t("ui.noChanges")
		root.append(empty)
	}
	for(const entry of entries) {
		const section = document.createElement("section")
		section.style.marginBottom = "12px"
		const heading = document.createElement("div")
		heading.style.fontWeight = "bold"
		heading.textContent = entry.date ? `${entry.version} — ${entry.date}` : entry.version
		const list = document.createElement("ul")
		list.style.margin = "4px 0 0"
		list.style.paddingLeft = "18px"
		for(const item of entry.items) {
			const li = document.createElement("li")
			li.textContent = item
			list.append(li)
		}
		section.append(heading, list)
		root.append(section)
	}

	function show() {
		root.style.display = ""
	}
	function hide() {
		root.style.display = "none"
	}
	return {
		root,
		isVisible: () => root.style.display !== "none",
		toggle: () => (root.style.display === "none" ? show() : hide()),
	}
}
