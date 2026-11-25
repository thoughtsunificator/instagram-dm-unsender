import { test } from "../../../test/setup.js"
import { main } from "./main.js"

test("main starts every feature", t => {
	t.notThrows(() => {
		const features = main(t.context.window)
		t.is(features.length, 1)
	})
})
