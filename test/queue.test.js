import test from "ava"

import Queue from "../src/runtime/queue.js"
import { Task } from "../src/runtime/task.js"


class TestTask extends Task {
	constructor(callback) {
		super()
		this.callback = callback
	}
	run() {
		return new Promise(this.callback)
	}
}
test("Queue add", async t => {
	const queue = new Queue()
	const tasks = [
		new TestTask({
		}),
		new TestTask({
		}),
		new TestTask({
		}),
		new TestTask({
		}),
	]
	t.is(queue.length, 0)
	for(const task of tasks) {
		queue.add(task)
	}
	t.is(queue.length, 4)
	t.deepEqual(queue.items.map(item => item.task), tasks)
})
