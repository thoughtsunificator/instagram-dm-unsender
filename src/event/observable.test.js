import { test } from "../../test/setup.js"
import { Observable } from "./observable.js"

test("Observable emits to listeners in registration order", t => {
	const observable = new Observable()
	const calls = []
	observable.on("ping", (value) => calls.push(["a", value]))
	observable.on("ping", (value) => calls.push(["b", value]))
	observable.emit("ping", 1)
	t.deepEqual(calls, [["a", 1], ["b", 1]])
})

test("Observable off removes a listener", t => {
	const observable = new Observable()
	let count = 0
	const listener = () => count++
	observable.on("ping", listener)
	observable.emit("ping")
	observable.off("ping", listener)
	observable.emit("ping")
	t.is(count, 1)
})

test("Observable keeps notifying when a listener throws", t => {
	const observable = new Observable()
	let called = false
	observable.on("ping", () => {
		throw new Error("boom")
	})
	observable.on("ping", () => {
		called = true
	})
	t.notThrows(() => observable.emit("ping"))
	t.true(called)
})
