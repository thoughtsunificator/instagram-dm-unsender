import { test } from "../../../test/test.js"
import { main } from "./main.js"

test("main", t => {
	t.notThrows(() => {
		main(t.context.window)
	})
})

