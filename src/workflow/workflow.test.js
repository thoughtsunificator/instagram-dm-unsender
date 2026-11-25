import { test } from "../../test/setup.js"
import { Workflow, pipe, WorkflowAbortedError } from "./workflow.js"

test("pipe passes each result to the next step", async t => {
	const result = await pipe(new AbortController(), [
		(value) => value + 1,
		(value, abortController) => { t.true(abortController instanceof AbortController); return value * 10 },
	], 1)
	t.is(result, 20)
})

test("pipe stops at the step following an abort", async t => {
	const controller = new AbortController()
	let reached = false
	await t.throwsAsync(() => pipe(controller, [
		() => controller.abort("halt"),
		() => { reached = true },
	]), { message: /Workflow aborted: halt/ })
	t.false(reached)
})

test("withBackoff retries until the task succeeds", async t => {
	const workflow = new Workflow()
	let attempts = 0
	const result = await workflow.withBackoff(() => {
		attempts++
		if(attempts < 3) {
			throw new Error("not yet")
		}
		return Promise.resolve("ok")
	}, { retries: 3, baseMs: 0 })
	t.is(result, "ok")
	t.is(attempts, 3)
})

test("withBackoff rethrows after the retries are exhausted", async t => {
	const workflow = new Workflow()
	let attempts = 0
	await t.throwsAsync(() => workflow.withBackoff(() => {
		attempts++
		throw new Error("always")
	}, { retries: 2, baseMs: 0 }), { message: "always" })
	t.is(attempts, 3)
})

test("withBackoff does not retry once aborted", async t => {
	const workflow = new Workflow()
	let attempts = 0
	await t.throwsAsync(() => workflow.withBackoff(() => {
		attempts++
		workflow.abort("stop")
		throw new Error("failed")
	}, { retries: 5, baseMs: 0 }))
	t.is(attempts, 1)
})

test("metrics count and emit", t => {
	const workflow = new Workflow()
	const seen = []
	workflow.on("metrics", metric => seen.push(metric))
	workflow.metrics.count("unsent")
	workflow.metrics.count("unsent", 2)
	t.is(workflow.metrics.counters.unsent, 3)
	t.deepEqual(seen.map(metric => metric.value), [1, 3])
})

test("child workflows share the abort controller of their parent", t => {
	const parent = new Workflow()
	const child = new Workflow(parent.abortController)
	parent.abort("stop")
	t.true(child.isAborted())
	t.true(child.abortController.signal.aborted)
	t.throws(() => child.throwIfAborted(), { instanceOf: Error })
	t.is(WorkflowAbortedError("x").name, "WorkflowAbortedError")
})
