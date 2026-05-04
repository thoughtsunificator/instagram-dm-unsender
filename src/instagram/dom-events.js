export { dispatchHoverOut, dispatchHoverIn }

/**
 * Dispatches pointer and mouse hover events on a target element.
 * Instagram's React uses pointer events internally; mouse events alone are insufficient.
 *
 * @param {Element} target
 */
function dispatchHoverIn(target) {
	const rect = target.getBoundingClientRect()
	const opts = {
		bubbles: true,
		cancelable: true,
		clientX: rect.x + rect.width / 2,
		clientY: rect.y + rect.height / 2,
		pointerId: 1,
		pointerType: "mouse",
	}
	target.dispatchEvent(new PointerEvent("pointerenter", { ...opts, bubbles: false }))
	target.dispatchEvent(new PointerEvent("pointerover", opts))
	target.dispatchEvent(new PointerEvent("pointermove", opts))
	target.dispatchEvent(new MouseEvent("mouseenter", { ...opts, bubbles: false }))
	target.dispatchEvent(new MouseEvent("mouseover", opts))
	target.dispatchEvent(new MouseEvent("mousemove", opts))
}

/**
 * Dispatches pointer and mouse leave events on a target element.
 *
 * @param {Element} target
 */
function dispatchHoverOut(target) {
	const rect = target.getBoundingClientRect()
	const opts = {
		bubbles: true,
		cancelable: true,
		clientX: rect.x + rect.width / 2,
		clientY: rect.y + rect.height / 2,
		pointerId: 1,
		pointerType: "mouse",
	}
	target.dispatchEvent(new PointerEvent("pointerout", opts))
	target.dispatchEvent(new PointerEvent("pointerleave", { ...opts, bubbles: false }))
	target.dispatchEvent(new MouseEvent("mouseout", opts))
	target.dispatchEvent(new MouseEvent("mouseleave", { ...opts, bubbles: false }))
}

