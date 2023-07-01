import { waitForElement } from "./wait-for-element.js"

export function clickElement(clickTarget, target, getElement) {
	const promise = waitForElement(target, getElement)
	clickTarget.click()
	return getElement() || promise
}
