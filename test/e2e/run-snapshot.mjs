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
	const snapshotArg = arg("--snapshot")
	const snapshotDir = path.resolve(snapshotArg || path.join(repoRoot, "test/fixtures/instagram-snapshots/example"))
	const userscriptPath = path.resolve(arg("--userscript", path.join(repoRoot, "dist/idmu.user.js")))
	const scenario = arg("--scenario", "")
	const artifactsDir = path.resolve(arg("--artifacts-dir", path.join(repoRoot, "test/e2e/artifacts")))
	const chromeBin = process.env.CHROME_BIN || "chromium"
	const port = 9229 + Math.floor(Math.random() * 500)

	try {
		await fs.access(path.join(snapshotDir, "meta.json"))
	} catch {
		console.error(`[e2e] Snapshot not found: ${snapshotDir}`)
		console.error("Provide --snapshot <dir> containing meta.json/page.html/resources/.")
		console.error("Capture one: node test/e2e/capture-snapshot.mjs --session <browser-ctl-session> --name <name>")
		console.error("Or use:       node test/e2e/capture-snapshot.mjs --from <archive-dir> --name <name>")
		process.exit(2)
	}
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
	let cdp = null

	try {
		cdp = await connectCdp(port)
		cdp.consoleLogs = []
		await cdp.send("Runtime.enable")
		await cdp.send("Log.enable").catch(() => {})
		cdp.on("Runtime.consoleAPICalled", p => {
			const msg = (p.args || []).map(a => a.value ?? a.description ?? a.type).join(" ")
			cdp.consoleLogs.push({ type: p.type, msg, ts: Date.now() })
		})
		cdp.on("Log.entryAdded", p => cdp.consoleLogs.push({ type: p.entry?.level || "log", msg: p.entry?.text || "", ts: Date.now() }))
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
		if(failed.length) {
			await dumpArtifacts(cdp, artifactsDir, { reason: "checks-failed", checks, scenario, snapshotDir })
			console.error(`[e2e] ${failed.length} check(s) failed`)
			process.exitCode = 1
		} else {
			console.log(`[e2e] ${checks.length} checks passed`)
		}
		await cdp.close().catch(() => {})
		cdp = null
	} catch (err) {
		console.error(err?.stack || err)
		if(cdp) await dumpArtifacts(cdp, artifactsDir, { reason: "exception", error: String(err?.stack || err), scenario, snapshotDir }).catch(() => {})
		process.exitCode = 1
	} finally {
		if(cdp) await cdp.close().catch(() => {})
		if(!chromeClosed) chrome.kill("SIGTERM")
		await replay.close().catch(() => {})
	}
}

async function runUnsendScenario(cdp, ok) {
	await cdp.evaluate("document.getElementById('idmu-onboarding')?.querySelector('button')?.click()")
	await sleep(200)
	const injected = await cdp.evaluate("window.__idmuE2E?.state?.unsent === 0")
	ok("unsend scenario injected", injected)

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
		const diag = await cdp.evaluate(`(() => ({status: document.getElementById('idmu-status')?.textContent, progress: document.getElementById('idmu-progress')?.textContent, unsent: window.__idmuE2E?.state?.unsent, debug: window.__idmuDebug?.formatText?.().slice(-4000), menu: Boolean(document.querySelector('#idmu-menu button'))}))()`)
		console.error("[e2e] timeout diag", diag)
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

async function dumpArtifacts(cdp, artifactsDir, meta) {
	if(!cdp) return
	const stamp = new Date().toISOString().replace(/[:.]/g, "-")
	const dir = path.join(artifactsDir, stamp)
	await fs.mkdir(dir, { recursive: true })
	const write = async (name, value) => fs.writeFile(path.join(dir, name), typeof value === "string" ? value : JSON.stringify(value, null, 2))
	await write("meta.json", meta)
	try { await write("console.json", cdp.consoleLogs || []) } catch {}
	try { await write("debug-log.txt", await cdp.evaluate("window.__idmuDebug?.formatText?.() || ''")) } catch {}
	try { await write("state.json", await cdp.evaluate(`(() => ({status: document.getElementById('idmu-status')?.textContent, progress: document.getElementById('idmu-progress')?.textContent, url: location.href, title: document.title, unsent: window.__idmuE2E?.state?.unsent, feature: Boolean(window.__idmuFeature), debug: Boolean(window.__idmuDebug), testApi: Boolean(window.__idmuTest)}))()`)) } catch {}
	try { await write("dom.html", await cdp.evaluate("document.documentElement.outerHTML")) } catch {}
	try {
		const shot = await cdp.send("Page.captureScreenshot", { format: "png" })
		if(shot?.data) await fs.writeFile(path.join(dir, "screenshot.png"), Buffer.from(shot.data, "base64"))
	} catch {}
	console.error(`[e2e] artifacts saved: ${dir}`)
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
