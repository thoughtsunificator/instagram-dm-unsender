/** @module parse-changelog Reads CHANGELOG.md into entries shown by the "What's new" panel */

export { parseChangelog }

const HEADING = /^##\s+(.+?)(?:\s+—\s+(.+?))?\s*$/
const ITEM = /^\s*[-*]\s+(.*\S)\s*$/

/**
 * Each "## <version> — <date>" heading starts an entry, each "- " line below it is an item.
 * Anything else (title, prose) is ignored.
 *
 * @param {string} markdown
 * @returns {{ version: string, date: string, items: string[] }[]}
 */
function parseChangelog(markdown) {
	const entries = []
	let current = null
	for(const line of markdown.split(/\r?\n/)) {
		const heading = HEADING.exec(line)
		if(heading) {
			current = { version: heading[1], date: heading[2] ?? "", items: [] }
			entries.push(current)
			continue
		}
		const item = ITEM.exec(line)
		if(item && current) {
			current.items.push(item[1])
		}
	}
	return entries
}
