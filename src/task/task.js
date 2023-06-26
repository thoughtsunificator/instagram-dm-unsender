export default class Task {
    /**
     * 
     * @param {Node} window 
     * @param {Node} root 
     * @param {*} data 
     */
    constructor(window, root, data) {
        this._window = window
        this._root = root
        this._data = data
    }
    get window() {
        return this._window
    }
    get root() {
        return this._root
    }

    get data() {
        return this._data
    }
    /**
     * @abstract
     * @returns {Promise}
     */
    run() {
        throw new Error("run method not implemented")
    }
}
