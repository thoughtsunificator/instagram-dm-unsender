#!/usr/bin/env node
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { createReplayServer } from "./replay-server.mjs"
import { connectCdp } from "./cdp.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "../..")

function arg(name, fallback = null) {
	const i = process.argv.indexOf(name)
	return i >= 0 ? process.argv[i + 1] ?? fallback : fallback
}

async function main() {
	const snapshotDir = path.resolve(arg("--snapshot", path.join(repoRoot, "test/fixtures/instagram-snapshots/example")))
	const userscriptPath = path.resolve(arg("--userscript", path.join(repoRoot, "dist/idmu.user.js")))
	const chromeBin = process.env.CHROME_BIN || "chromium"
	const port = 9229 + Math.floor(Math.random() * 500)

	await fs.access(path.join(snapshotDir, "meta.json"))
	const userscript = await fs.readFile(userscriptPath, "utf8")
	const replay = await createReplayServer(snapshotDir)
	console.log(`[e2e] replay: ${replay.baseUrl}`)
	console.log(`[e2e] snapshot: ${snapshotDir}`)

	const chromeArgs = [
		`--remote-debugging-port=${port}`,
		"--headless=new",
		"--disable-gpu",
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-background-networking",
		"--disable-component-update",
		"--window-size=1400,900",
		"about:blank",
	]
	if(process.getuid?.() === 0) chromeArgs.push("--no-sandbox")
	const chrome = spawn(chromeBin, chromeArgs, { stdio: "ignore" })
	let chromeClosed = false
	chrome.on("exit", () => { chromeClosed = true })

	try {
		const cdp = await connectCdp(port)
		await cdp.send("Runtime.enable")
		await cdp.send("Page.enable")
		await cdp.send("Page.navigate", { url: replay.baseUrl + (replay.snapshotPath || "/__page__") })
		await waitFor(async () => (await cdp.evaluate("document.readyState")) === "complete" || (await cdp.evaluate("document.readyState")) === "interactive", 15000)
		// Inject userscript. Strip userscript metadata block for plain eval.
		const code = userscript.replace(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\n?/, "")
		await cdp.evaluate(code)
		await waitFor(async () => await cdp.evaluate("Boolean(document.getElementById('idmu-menu'))"), 15000)

		const checks = []
		const ok = (name, cond) => { checks.push({ name, ok: Boolean(cond) }); console.log(`${cond ? "PASS" : "FAIL"} ${name}`) }
		ok("menu rendered", await cdp.evaluate("Boolean(document.getElementById('idmu-menu'))"))
		ok("unsend button present", await cdp.evaluate("Boolean(document.querySelector('#idmu-menu button'))"))
		ok("status present", await cdp.evaluate("Boolean(document.getElementById('idmu-status'))"))
		ok("debug button present", await cdp.evaluate("Boolean(document.getElementById('idmu-debug-toggle'))"))
		ok("__idmuDebug installed", await cdp.evaluate("Boolean(window.__idmuDebug)"))
		ok("onboarding modal shown on first run", await cdp.evaluate("Boolean(document.getElementById('idmu-onboarding'))"))

		const failed = checks.filter(c => !c.ok)
		await cdp.close().catch(() => {})
		if(failed.length) {
			console.error(`[e2e] ${failed.length} check(s) failed`)
			process.exitCode = 1
		} else {
			console.log(`[e2e] ${checks.length} checks passed`)
		}
	} finally {
		if(!chromeClosed) chrome.kill("SIGTERM")
		await replay.close().catch(() => {})
	}
}

async function waitFor(fn, timeoutMs) {
	const deadline = Date.now() + timeoutMs
	let lastErr
	while(Date.now() < deadline) {
		try { if(await fn()) return } catch(e) { lastErr = e }
		await new Promise(r => setTimeout(r, 200))
	}
	throw lastErr || new Error("timeout")
}

main().catch(err => { console.error(err); process.exit(1) })
