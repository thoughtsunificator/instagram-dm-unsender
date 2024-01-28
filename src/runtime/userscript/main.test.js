import { test } from "../../../test/setup.js"
import { main } from "./main.js"

test("main", t => {
	t.notThrows(() => {
		main(t.context.window)
	})
})

