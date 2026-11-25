import { test } from "../../test/setup.js"
import { t as translate, setLocale, resolveLocale, currentLocale, LOCALES } from "./i18n.js"

test("resolveLocale matches the base language of a regional tag", t => {
	t.is(resolveLocale(["fr-CA"]), "fr")
	t.is(resolveLocale(["FR_be"]), "fr")
})

test("resolveLocale tries the most specific tag first and keeps the preference order", t => {
	const catalogs = { en: {}, "zh-hant": {}, zh: {} }
	t.is(resolveLocale(["zh-Hant-TW"], catalogs), "zh-hant")
	t.is(resolveLocale(["zh-CN"], catalogs), "zh")
	t.is(resolveLocale(["de-DE", "fr-FR", "en-US"]), "fr")
	t.is(resolveLocale(["xx", "fr"]), "fr")
})

test("resolveLocale falls back to English when nothing matches or input is empty", t => {
	t.is(resolveLocale([]), "en")
	t.is(resolveLocale(["", undefined, "klingon"]), "en")
})

test("setLocale forces the language and null restores detection", t => {
	setLocale("fr")
	t.is(currentLocale(), "fr")
	t.is(translate("ui.unsendAll"), LOCALES.fr["ui.unsendAll"])
	setLocale(null)
	t.is(translate("ui.unsendAll"), "Unsend all DMs")
})

test("translate fills placeholders and leaves unknown ones visible", t => {
	setLocale("en")
	t.is(translate("workflow.allPagesLoaded", { pages: 3 }), "All pages loaded (3 in total).")
	t.is(translate("workflow.noMessagesRetry", { attempt: 1 }), "No messages detected, retrying (1/{max})...")
	setLocale(null)
})

test("translate selects the plural form with CLDR rules for the active language", t => {
	setLocale("en")
	t.is(translate("summary.done", { count: 1 }), "Done. 1 message unsent.")
	t.is(translate("summary.done", { count: 0 }), "Done. 0 messages unsent.")
	t.is(translate("summary.done", { count: 2 }), "Done. 2 messages unsent.")
	setLocale("fr")
	t.is(translate("summary.done", { count: 1 }), "Terminé. 1 message retiré.")
	t.is(translate("summary.done", { count: 5 }), "Terminé. 5 messages retirés.")
	setLocale(null)
})

test("translate returns the key itself when it is not defined anywhere", t => {
	t.is(translate("unknown.key"), "unknown.key")
})

test("every key a catalog defines also exists in English, the source of truth", t => {
	for(const [locale, catalog] of Object.entries(LOCALES)) {
		for(const key of Object.keys(catalog)) {
			t.true(key in LOCALES.en, `${locale} defines ${key} which English does not`)
		}
	}
})
