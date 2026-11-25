export { connectCdp }

async function connectCdp(port, timeoutMs = 10000) {
	const deadline = Date.now() + timeoutMs
	let lastErr
	while(Date.now() < deadline) {
		try {
			const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
			const page = list.find(t => t.type === "page") || list[0]
			if(!page?.webSocketDebuggerUrl) throw new Error("No page target")
			const ws = new WebSocket(page.webSocketDebuggerUrl)
			await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
			return createClient(ws)
		} catch(error) {
			lastErr = error
			await new Promise(r => setTimeout(r, 100))
		}
	}
	throw lastErr || new Error("CDP connect timeout")
}

function createClient(ws) {
	let id = 0
	const pending = new Map()
	ws.onmessage = ev => {
		const msg = JSON.parse(String(ev.data))
		if(msg.id && pending.has(msg.id)) {
			const { resolve, reject } = pending.get(msg.id)
			pending.delete(msg.id)
			if(msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)))
			else resolve(msg.result)
		}
	}
	function send(method, params = {}) {
		const msgId = ++id
		const payload = JSON.stringify({ id: msgId, method, params })
		return new Promise((resolve, reject) => {
			pending.set(msgId, { resolve, reject })
			ws.send(payload)
		})
	}
	async function evaluate(expression) {
		const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
		if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
		return r.result?.value
	}
	return {
		send, evaluate,
		close: () => new Promise(resolve => { ws.onclose = resolve; ws.close() }),
	}
}
