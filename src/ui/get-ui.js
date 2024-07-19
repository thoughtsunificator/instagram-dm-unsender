/** @module get-ui UI loader module. Allow loading of a certain UI based on a given strategy (locale etc..)
 * There might be need for multiple UI as Instagram might serve different apps based on location for example.
 * There is also a need to internationalize each ui so that it doesn't fail if we change the language.
 */

import DefaultUI from "./default/default-ui.js"
/* eslint-disable-next-line no-unused-vars */
import UI from "./ui.js"

/**
 *
 * @returns {UI}
 */
export default function getUI() {
	return DefaultUI
}
