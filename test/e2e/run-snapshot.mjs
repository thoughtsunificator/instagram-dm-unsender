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
	const scenario = arg("--scenario", "")
	const chromeBin = process.env.CHROME_BIN || "chromium"
	const port = 9229 + Math.floor(Math.random() * 500)

	await fs.access(path.join(snapshotDir, "meta.json"))
	const userscript = await fs.readFile(userscriptPath, "utf8")
	const replay = await createReplayServer(snapshotDir)
	console.log(`[e2e] replay: ${replay.baseUrl}`)
	console.log(`[e2e] snapshot: ${snapshotDir}`)
	if(scenario) console.log(`[e2e] scenario: ${scenario}`)

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
		await waitFor(async () => {
			const rs = await cdp.evaluate("document.readyState")
			return rs === "complete" || rs === "interactive"
		}, 15000)

		if(scenario) {
			const scenarioJsEarly = await fs.readFile(path.join(__dirname, `scenario-${scenario}.js`), "utf8")
			await cdp.evaluate(scenarioJsEarly)
		}
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

		if(scenario === "unsend") {
			await runUnsendScenario(cdp, ok)
		}

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

async function runUnsendScenario(cdp, ok) {
	// Dismiss onboarding modal if present
	await cdp.evaluate("document.getElementById('idmu-onboarding')?.querySelector('button')?.click()")
	await sleep(200)
	const injected = await cdp.evaluate("window.__idmuE2E?.state?.unsent === 0")
	ok("unsend scenario injected", injected)

	// Click Unsend all DMs
	await cdp.evaluate("window.__idmuFeature ? window.__idmuFeature.toggle() : document.querySelector('#idmu-menu button').click()")
	try {
		await waitFor(async () => {
			const state = await cdp.evaluate(`(() => {
				const text = document.getElementById('idmu-status')?.textContent || '';
				const ended = (window.__idmuDebug?.getEntries?.() || []).some(e => e.message === 'Workflow ended' && (e.data?.unsent ?? 0) >= 1);
				const unsent = window.__idmuE2E?.state?.unsent ?? 0;
				return { text, ended, unsent };
			})()`)
			return /Done\.|Terminé\.|Aborted\.|Interrompu\.|Stopped|Arrêté/.test(state.text) || (state.ended && state.unsent >= 1)
		}, 45000)
	} catch (e) {
		const diag = await cdp.evaluate(`(() => ({status: document.getElementById('idmu-status')?.textContent, progress: document.getElementById('idmu-progress')?.textContent, unsent: window.__idmuE2E?.state?.unsent, debug: window.__idmuDebug?.formatText?.().slice(-2000), menu: Boolean(document.querySelector('#idmu-menu button'))}))()`)
		console.error('[e2e] timeout diag', diag)
		throw e
	}

	const status = await cdp.evaluate("document.getElementById('idmu-status')?.textContent || ''")
	const unsent = await cdp.evaluate("window.__idmuE2E?.state?.unsent ?? -1")
	const progress = await cdp.evaluate("document.getElementById('idmu-progress')?.textContent || ''")
	const ended = await cdp.evaluate(`(window.__idmuDebug?.getEntries?.() || []).some(e => e.message === 'Workflow ended' && (e.data?.unsent ?? 0) >= 1)`)
	console.log(`[e2e] status: ${status}`)
	console.log(`[e2e] progress: ${progress}`)
	console.log(`[e2e] mocked unsent: ${unsent}`)
	console.log(`[e2e] workflow ended event: ${ended}`)
	ok("workflow completed", /Done\.|Terminé\./.test(status) || ended)
	ok("at least one message unsent", Number(unsent) >= 1)
	ok("progress shows unsent", /[1-9].*unsent|retiré/i.test(progress) || ended)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function waitFor(fn, timeoutMs) {
	const deadline = Date.now() + timeoutMs
	let lastErr
	while(Date.now() < deadline) {
		try { if(await fn()) return } catch(e) { lastErr = e }
		await new Promise(r => setTimeout(r, 200))
	}
	throw lastErr || new Error("timeout")
}

main().catch(err => { console.error(err?.stack || err); process.exit(1) })
