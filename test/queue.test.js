import test from "ava"

import Queue from "../src/idmu/queue.js"
import { Task } from "../src/idmu/task.js"


class TestTask extends Task {
	constructor(data) {
		super()
		this.data = data
	}
	run() {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				if(this.data.resolve) {
					this.data.callback()
					resolve()
				} else {
					this.data.resolve = true
					reject()
				}
			}, this.data.delay)
		})
	}
}

// test("Queue tasks", async t => {
// 	const queue = new Queue()
// 	const ids = []
// 	queue.add(new TestTask({
// 		callback: () => ids.push(1),
// 		delay: 0,
// 		resolve: true
// 	}))
// 	queue.add(new TestTask({
// 		callback: () => ids.push(2),
// 		delay: 0,
// 		resolve: true
// 	}))
// 	queue.add(new TestTask({
// 		callback: () => ids.push(3),
// 		delay: 0,
// 		resolve: true
// 	}))
// 	await queue.add(new TestTask({
// 		callback: () => ids.push(4),
// 		delay: 0,
// 		resolve: true
// 	}))
// 	t.deepEqual(ids, [1,2,3,4])
// })

// test("Queue retry=false", async t => {
// 	const queue = new Queue()
// 	const ids = []
// 	queue.add(new TestTask({
// 		callback: () => ids.push(1),
// 		delay: 0,
// 		resolve: true
// 	}))
// 	queue.add(new TestTask({
// 		callback: () => ids.push(2),
// 		delay: 0,
// 		resolve: true
// 	}))
// 	queue.add(new TestTask({
// 		callback: () => ids.push(3),
// 		delay: 0,
// 		resolve: false
// 	})).catch(() => {

// 	})
// 	await queue.add(new TestTask({
// 		callback: () => ids.push(4),
// 		delay: 0,
// 		resolve: true
// 	}))
// 	t.deepEqual(ids, [1,2,4])
// })


// test("Queue retry=true", async t => {
// 	return new Promise((resolve) => {
// 		const queue = new Queue()
// 		const ids = []
// 		queue.add(new TestTask({
// 			callback: () => ids.push(1),
// 			delay: 0,
// 			resolve: true
// 		}))
// 		queue.add(new TestTask({
// 			callback: () => ids.push(2),
// 			delay: 0,
// 			resolve: true
// 		}))
// 		queue.add(new TestTask({
// 			callback: () => {
// 				ids.push(3)
// 				t.deepEqual(ids, [1,2,4,5,3])
// 				resolve()
// 			},
// 			delay: 0,
// 			resolve: false
// 		}), true).catch(() => {

// 		})
// 		queue.add(new TestTask({
// 			callback: () => ids.push(4),
// 			delay: 0,
// 			resolve: true
// 		}))
// 		queue.add(new TestTask({
// 			callback: () => ids.push(5),
// 			delay: 0,
// 			resolve: true
// 		}))

// 	})
// })


