import test from "ava"

import Queue from "../src/idmu/queue.js"
import { Task } from "../src/idmu/task.js"


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

test("Queue clearQueue", async t => {
	const queue = new Queue()
	const ids = []
	const tasks = [
		new TestTask((resolve) => {
			ids.push(1)
			resolve()
		}),
		new TestTask((resolve) => {
			ids.push(2)
			resolve()
		}),
		new TestTask((resolve) => {
			ids.push(3)
			resolve()
		}),
		new TestTask((resolve) => {
			ids.push(4)
			resolve()
		})
	]
	for(const task of tasks) {
		queue.add(task)
	}
	for(const task of tasks) {
		await queue.clearQueue()
	}
	t.deepEqual(ids, [1,2,3,4])
})
