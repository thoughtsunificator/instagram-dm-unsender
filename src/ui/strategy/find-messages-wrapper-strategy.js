/**
 *
 * @param {Window} window
 * @returns {HTMLDivElement}
 */
export default function findMessagesWrapperStrategy(window) {
	return window.document.querySelector("div[role=grid] > div > div > div > div")
}
