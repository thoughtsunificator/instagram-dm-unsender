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
	const name = arg("--name")
	const outRoot = path.resolve(arg("--out", "test/fixtures/instagram-snapshots"))
	if(!session || !name) {
		console.error("Usage: node test/e2e/capture-snapshot.mjs --session <browser-ctl-session> --name <snapshot-name> [--out <dir>]")
		process.exit(2)
	}
	// Flush archive for active tab, then copy latest pages entry
	const arch = spawnSync("browser-ctl", ["-S", session, "archive"], { encoding: "utf8" })
	if(arch.status !== 0) console.error(arch.stderr || arch.stdout)
	const pagesDirRes = spawnSync("browser-ctl", ["-S", session, "pages", "-p"], { encoding: "utf8" })
	if(pagesDirRes.status !== 0) throw new Error(pagesDirRes.stderr || "pages -p failed")
	const pagesDir = pagesDirRes.stdout.trim()
	const igDir = path.join(pagesDir, "www.instagram.com")
	const entries = (await fs.readdir(igDir)).filter(e => e.includes("Messages")).sort()
	if(entries.length === 0) throw new Error("No Instagram Messages archive found in " + igDir)
	const latest = entries[entries.length - 1]
	const src = path.join(igDir, latest)
	const dst = path.join(outRoot, name)
	await fs.rm(dst, { recursive: true, force: true })
	await fs.mkdir(path.dirname(dst), { recursive: true })
	await fs.cp(src, dst, { recursive: true })
	console.log(`Saved snapshot ${latest} -> ${dst}`)
}

main().catch(err => { console.error(err); process.exit(1) })
