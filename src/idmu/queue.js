export default class Queue {
    constructor() {
        this.lastPromise = null
    }
    /**
     *
     * @param {UnsendTask} task
     * @returns {Promise}
     */
    add(task, delay=0, retry) {
        if(this.lastPromise) {
            this.lastPromise = this.lastPromise.then(() => new Promise(resolve => {
                setTimeout(() => task.run().then(resolve).catch(() => {
                    if(retry) {
                        this.add(task, delay, retry)
                    }
                    resolve()
                }), delay)
            }))
        } else {
            this.lastPromise = task.run()
        }
        return this.lastPromise
    }
 }