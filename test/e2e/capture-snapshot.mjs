#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"

function arg(name, fallback = null) {
	const i = process.argv.indexOf(name)
	return i >= 0 ? process.argv[i + 1] ?? fallback : fallback
}
function has(name) { return process.argv.includes(name) }

function runBrowserCtl(args, opts = {}) {
	const r = spawnSync("browser-ctl", args, { encoding: "utf8", ...opts })
	return r
}

function jsonBrowserCtl(args) {
	const r = runBrowserCtl(["-j", ...args])
	if(r.status !== 0) throw new Error((r.stderr || r.stdout || "browser-ctl failed").trim())
	try { return JSON.parse(r.stdout) } catch { throw new Error("Invalid JSON from browser-ctl: " + r.stdout.slice(0, 200)) }
}

function pickSession(requested) {
	if(requested && requested !== "auto") return requested
	const which = spawnSync("which", ["browser-ctl"], { encoding: "utf8" })
	if(which.status !== 0) throw new Error("browser-ctl not found in PATH. Install it or use --from <archive-dir>.")
	let sessions
	try { sessions = jsonBrowserCtl(["sessions"]) } catch (e) {
		throw new Error("Cannot list browser-ctl sessions. Is a browser running with browser-ctl support? " + e.message)
	}
	if(!Array.isArray(sessions) || sessions.length === 0) throw new Error("No browser-ctl sessions found. Open a browser or pass --from <archive-dir>.")
	if(requested && requested !== "auto") return requested
	// Prefer a session that has an Instagram Messages tab
	for(const s of sessions) {
		try {
			const tabs = jsonBrowserCtl(["-S", s.id, "tabs"])
			if(tabs.some(t => String(t.url || "").includes("instagram.com/direct"))) return s.id
		} catch {}
	}
	// Prefer instagram profile
	const igProfile = sessions.find(s => /instagram/i.test(String(s.profile || "")))
	if(igProfile) return igProfile.id
	if(sessions.length === 1) return sessions[0].id
	throw new Error("Multiple browser-ctl sessions found; pass --session <id>. Sessions: " + sessions.map(s => `${s.id} (${s.profile})`).join(", "))
}

async function main() {
	const from = arg("--from")
	let session = arg("--session", "auto")
	let name = arg("--name")
	const outRoot = path.resolve(arg("--out", "test/fixtures/instagram-snapshots"))
	const tabId = arg("--tab")

	if(!name && !from) {
		// auto-name later
	}

	let src
	let sourceMeta = {}
	if(from) {
		src = path.resolve(from)
	} else {
		session = pickSession(session)
		console.log(`[capture] session: ${session}`)
		// archive active tab (or specified tab)
		const archiveArgs = ["-S", session, "archive"]
		if(tabId) archiveArgs.push("--tab", tabId)
		const arch = runBrowserCtl(archiveArgs, { encoding: "utf8" })
		if(arch.status !== 0) throw new Error(`browser-ctl archive failed: ${(arch.stderr || arch.stdout || "unknown error").trim()}`)
		const pagesDirRes = runBrowserCtl(["-S", session, "pages", "-p"], { encoding: "utf8" })
		if(pagesDirRes.status !== 0) throw new Error(`browser-ctl pages -p failed: ${(pagesDirRes.stderr || pagesDirRes.stdout || "unknown error").trim()}`)
		const pagesDir = pagesDirRes.stdout.trim()
		if(!pagesDir) throw new Error("browser-ctl pages -p returned empty path")
		const igDir = path.join(pagesDir, "www.instagram.com")
		let entries = []
		try { entries = (await fs.readdir(igDir)).filter(e => e.includes("Messages")).sort() }
		catch (e) { throw new Error(`Cannot read Instagram archive dir ${igDir}: ${e.message}. Is the active tab on instagram.com?`) }
		if(entries.length === 0) {
			try { entries = (await fs.readdir(igDir)).sort() }
			catch (e) { throw new Error(`Cannot read Instagram archive dir ${igDir}: ${e.message}`) }
		}
		if(entries.length === 0) throw new Error("No Instagram archive found in " + igDir + ". Open an Instagram DM tab and try again.")
		const latest = entries[entries.length - 1]
		src = path.join(igDir, latest)
		sourceMeta = { session, archive: latest }
	}

	await fs.access(path.join(src, "meta.json"))
	await fs.access(path.join(src, "page.html"))
	if(!name) {
		let meta = {}
		try { meta = JSON.parse(await fs.readFile(path.join(src, "meta.json"), "utf8")) } catch {}
		const slug = String(meta.title || "instagram-dm").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "instagram-dm"
		const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
		name = `${slug}-${ts}`
	}
	const dst = path.join(outRoot, name)
	await fs.rm(dst, { recursive: true, force: true })
	await fs.mkdir(path.dirname(dst), { recursive: true })
	await fs.cp(src, dst, { recursive: true })
	console.log(`Saved snapshot ${src} -> ${dst}`)
	console.log(JSON.stringify({ name, dst, ...sourceMeta }))
}

main().catch(err => { console.error(err?.stack || err.message || err); process.exit(1) })
