import { Observable } from "../../event/observable.js"
import { waitForElement } from "../../dom/async-events.js"

export { PageObservable }

/**
 * @param {Window} window
 */
function PageObservable() {
}
PageObservable.prototype = Object.create(Observable.prototype)
PageObservable.prototype.constructor = PageObservable

