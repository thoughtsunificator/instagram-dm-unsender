#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"

function arg(name, fallback = null) {
	const i = process.argv.indexOf(name)
	return i >= 0 ? process.argv[i + 1] ?? fallback : fallback
}

async function main() {
	const session = arg("--session")
	const from = arg("--from")
	const name = arg("--name")
	const outRoot = path.resolve(arg("--out", "test/fixtures/instagram-snapshots"))
	if(!name || (!session && !from)) {
		console.error("Usage:")
		console.error("  node test/e2e/capture-snapshot.mjs --session <browser-ctl-session> --name <snapshot-name> [--out <dir>]")
		console.error("  node test/e2e/capture-snapshot.mjs --from <archive-dir> --name <snapshot-name> [--out <dir>]")
		console.error("")
		console.error("--from accepts any directory containing meta.json/page.html (browser-ctl archive or manual copy).")
		process.exit(2)
	}

	let src
	if(from) {
		src = path.resolve(from)
	} else {
		const arch = spawnSync("browser-ctl", ["-S", session, "archive"], { encoding: "utf8" })
		if(arch.status !== 0) console.error(arch.stderr || arch.stdout)
		const pagesDirRes = spawnSync("browser-ctl", ["-S", session, "pages", "-p"], { encoding: "utf8" })
		if(pagesDirRes.status !== 0) throw new Error(pagesDirRes.stderr || "pages -p failed (is browser-ctl installed and session active?)")
		const pagesDir = pagesDirRes.stdout.trim()
		const igDir = path.join(pagesDir, "www.instagram.com")
		const entries = (await fs.readdir(igDir)).filter(e => e.includes("Messages")).sort()
		if(entries.length === 0) throw new Error("No Instagram Messages archive found in " + igDir)
		src = path.join(igDir, entries[entries.length - 1])
	}

	await fs.access(path.join(src, "meta.json"))
	await fs.access(path.join(src, "page.html"))
	const dst = path.join(outRoot, name)
	await fs.rm(dst, { recursive: true, force: true })
	await fs.mkdir(path.dirname(dst), { recursive: true })
	await fs.cp(src, dst, { recursive: true })
	console.log(`Saved snapshot ${src} -> ${dst}`)
}

main().catch(err => { console.error(err); process.exit(1) })
