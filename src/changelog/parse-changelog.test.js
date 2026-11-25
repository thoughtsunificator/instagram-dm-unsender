import { test } from "../../test/setup.js"
import { parseChangelog } from "./parse-changelog.js"

test("parseChangelog reads versions, dates and items", t => {
	const entries = parseChangelog([
		"# Changelog",
		"",
		"## Unreleased — 2026-11-25",
		"- Translatable UI",
		"* Progress line",
		"",
		"### not an entry",
		"## 0.7.1",
		"- Fix",
	].join("\n"))
	t.deepEqual(entries, [
		{ version: "Unreleased", date: "2026-11-25", items: ["Translatable UI", "Progress line"] },
		{ version: "0.7.1", date: "", items: ["Fix"] },
	])
})

test("parseChangelog ignores items before the first heading and handles CRLF", t => {
	t.deepEqual(parseChangelog("- orphan\r\n## 1.0 — 2026-01-01\r\n- one\r\n"), [
		{ version: "1.0", date: "2026-01-01", items: ["one"] },
	])
})
