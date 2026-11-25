import http from "node:http"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

export { createReplayServer }

/**
 * Serves a browser-ctl archived snapshot for deterministic e2e tests.
 * Rewrites absolute https:// URLs in the main HTML to local /__res__/ paths.
 *
 * @param {string} snapshotDir - directory containing meta.json, page.html, resources/
 * @returns {Promise<{server: http.Server, baseUrl: string, close: () => Promise<void>}>}
 */
async function createReplayServer(snapshotDir) {
	const dir = path.resolve(snapshotDir)
	const meta = JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf8"))
	const resourceByUrl = new Map()
	for(const r of meta.resources || []) {
		if(r.url && r.file) resourceByUrl.set(r.url, { ...r, abs: path.join(dir, r.file) })
	}
	const pageHtml = await fs.readFile(path.join(dir, "page.html"), "utf8")
	const snapshotPath = meta.url ? new URL(meta.url).pathname : "/__snapshot__"

	const server = http.createServer(async (req, res) => {
		try {
			const u = new URL(req.url, "http://127.0.0.1")
			if(u.pathname === "/" || u.pathname === "/__page__" || u.pathname === snapshotPath) {
				const rewritten = rewriteHtml(pageHtml, resourceByUrl)
				res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" })
				res.end(rewritten)
				return
			}
			if(u.pathname.startsWith("/__res__/")) {
				const originalUrl = decodeURIComponent(u.pathname.slice("/__res__/".length))
				const r = resourceByUrl.get(originalUrl)
				if(r) return await serveFile(res, r.abs, r.mimeType)
			}
			// Try direct URL match (for proxy-style requests)
			const fullUrl = u.searchParams.get("url")
			if(fullUrl && resourceByUrl.has(fullUrl)) {
				const r = resourceByUrl.get(fullUrl)
				return await serveFile(res, r.abs, r.mimeType)
			}
			res.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
			res.end("not found in snapshot: " + u.pathname)
		} catch(error) {
			res.writeHead(500, { "content-type": "text/plain; charset=utf-8" })
			res.end(String(error?.stack || error))
		}
	})

	await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
	const { port } = server.address()
	const baseUrl = `http://127.0.0.1:${port}`
	return {
		server, baseUrl, snapshotPath, meta,
		close: () => new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())),
	}
}

function rewriteHtml(html, resourceByUrl) {
	let out = html
	for(const url of resourceByUrl.keys()) {
		if(!url.startsWith("http")) continue
		const local = "/__res__/" + encodeURIComponent(url)
		out = out.split(url).join(local)
	}
	// Prevent live network calls from leaking during tests
	out = out.replace("<head>", `<head><meta name="idmu-snapshot" content="1"><script>window.__IDMU_SNAPSHOT__=true;</script>`)
	return out
}

async function serveFile(res, file, mimeType) {
	const body = await fs.readFile(file)
	res.writeHead(200, { "content-type": mimeType || "application/octet-stream", "cache-control": "no-store" })
	res.end(body)
}

if(process.argv[1] === fileURLToPath(import.meta.url)) {
	const snapshotDir = process.argv[2]
	if(!snapshotDir) {
		console.error("Usage: node test/e2e/replay-server.mjs <snapshot-dir>")
		process.exit(2)
	}
	const { baseUrl } = await createReplayServer(snapshotDir)
	console.log(baseUrl)
}
