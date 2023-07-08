import { test } from "../../../test/test.js"
import { render } from "./ui/ui.js"

test("userscript main render", t => {
	render(t.context.window)
	t.is(t.context.window.document.querySelectorAll("button").length, 2)
	t.pass()
})

