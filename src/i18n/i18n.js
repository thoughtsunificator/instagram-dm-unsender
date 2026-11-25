/** @module i18n Translates IDMU's own strings into the language of the page, falling back to English */

import { en } from "./locales/en.js"
import { fr } from "./locales/fr.js"

export { t, setLocale, resolveLocale, currentLocale, LOCALES, FALLBACK_LOCALE }

/**
 * Catalogs by locale. Adding a language means adding a file in ./locales/ and an entry here.
 * Every key of `en` is the source of truth: a missing key in another catalog falls back to English.
 */
const LOCALES = { en, fr }

const FALLBACK_LOCALE = "en"

/** Set by tests or by a user override, bypasses detection */
let forcedLocale = null

/**
 * Turns a list of language tags (as found in <html lang> or navigator.languages) into a catalog key.
 * "fr-CA" tries "fr-ca" then "fr", "zh-Hant-TW" tries "zh-hant-tw", "zh-hant", then "zh".
 *
 * @param {string[]} candidates - Language tags, by order of preference
 * @param {object}   [catalogs=LOCALES]
 * @returns {string} key of the matching catalog, FALLBACK_LOCALE when none matches
 */
function resolveLocale(candidates, catalogs = LOCALES) {
	const available = new Map(Object.keys(catalogs).map(key => [key.toLowerCase(), key]))
	for(const candidate of candidates) {
		if(typeof candidate !== "string" || candidate === "") {
			continue
		}
		const parts = candidate.toLowerCase().split(/[-_]/)
		for(let length = parts.length; length > 0; length--) {
			const match = available.get(parts.slice(0, length).join("-"))
			if(match) {
				return match
			}
		}
	}
	return FALLBACK_LOCALE
}

/**
 * @returns {string[]} language tags of the page, then of the browser
 */
function detectCandidates() {
	const candidates = []
	const doc = globalThis.document
	if(doc?.documentElement?.lang) {
		candidates.push(doc.documentElement.lang)
	}
	const nav = globalThis.navigator
	if(nav?.languages) {
		candidates.push(...nav.languages)
	}
	if(nav?.language) {
		candidates.push(nav.language)
	}
	return candidates
}

/**
 * @returns {string} catalog key in use
 */
function currentLocale() {
	return forcedLocale ?? resolveLocale(detectCandidates())
}

/**
 * @param {string|null} locale - A catalog key or a language tag, null to go back to detection
 */
function setLocale(locale) {
	forcedLocale = locale === null ? null : resolveLocale([locale])
}

/**
 * Translates a key and fills its {placeholders}.
 *
 * A message may be a plain string or an object keyed by CLDR plural category (zero, one, two, few, many, other),
 * selected with `vars.count` through Intl.PluralRules, so that every language gets the right plural form.
 *
 * @param {string} key
 * @param {object} [vars] - Placeholder values, `count` also selects the plural form
 * @returns {string}
 */
function t(key, vars = {}) {
	const locale = currentLocale()
	let message = LOCALES[locale]?.[key] ?? en[key]
	if(message === undefined) {
		return key
	}
	if(Array.isArray(message)) {
		return message.map(item => typeof item === "string" ? item.replace(/\{(\w+)\}/g, (placeholder, name) => (name in vars ? String(vars[name]) : placeholder)) : item)
	}
	if(typeof message === "object") {
		const category = new Intl.PluralRules(locale).select(Number(vars.count ?? 0))
		message = message[category] ?? message.other
	}
	return String(message).replace(/\{(\w+)\}/g, (placeholder, name) => (name in vars ? String(vars[name]) : placeholder))
}
