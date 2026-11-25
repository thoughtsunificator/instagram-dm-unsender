import { test } from "../../test/setup.js"
import { sleep, backoffDelay, randomDelay } from "./timing.js"

test("backoffDelay doubles each attempt and is capped", t => {
	t.is(backoffDelay(1, 3000, 60000), 3000)
	t.is(backoffDelay(2, 3000, 60000), 6000)
	t.is(backoffDelay(3, 3000, 60000), 12000)
	t.is(backoffDelay(10, 3000, 60000), 60000)
})

test("randomDelay stays within the inclusive range", t => {
	t.is(randomDelay(1000, 2000, () => 0), 1000)
	t.is(randomDelay(1000, 2000, () => 0.999999), 2000)
})

test("sleep rejects when the signal is aborted", async t => {
	const controller = new AbortController()
	const promise = sleep(60000, controller.signal)
	controller.abort("stop")
	await t.throwsAsync(() => promise, { message: /sleep aborted: stop/ })
})

test("sleep rejects immediately when already aborted", async t => {
	const controller = new AbortController()
	controller.abort("early")
	await t.throwsAsync(() => sleep(10, controller.signal))
})
