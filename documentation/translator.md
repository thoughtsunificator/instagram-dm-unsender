# Translator manual

idmu is translated in two places, and both must work in every language:

1. **IDMU's own strings** (button, status line, progress messages): one catalog per language in [`src/i18n/locales/`](../src/i18n/locales/). English ([`en.js`](../src/i18n/locales/en.js)) is the source of truth.
2. **Instagram's "Unsend" menu label**: Instagram shows its menus in the language of the account, so idmu has to recognise the label in that language. The list is [`UNSEND_TEXT_VARIANTS`](../src/instagram/messages.js).

## How the language is chosen

idmu looks at `<html lang>` of the page, then at the browser languages, and takes the first one it has a catalog for, trying the regional tag then its base language (`fr-CA` → `fr`). When nothing matches it uses English. A key missing from a catalog also falls back to English, so a partial translation is always safe to ship.

## Adding a language to the UI

1. Copy `src/i18n/locales/en.js` to `src/i18n/locales/<code>.js` (`<code>` is the language tag, e.g. `de`, `pt-BR`, `zh-Hant`) and translate the values. Keep the keys and the `{placeholders}` unchanged.
2. Plural messages are objects keyed by CLDR category (`one`, `few`, `many`, `other`, ...). Translate each category your language needs; the category is picked with `Intl.PluralRules`, so no code change is needed for plurals.
3. Register it in [`src/i18n/i18n.js`](../src/i18n/i18n.js) (`LOCALES`).
4. Run `npx ava src/i18n/i18n.test.js`. It checks that your catalog does not define keys English does not have.

## Adding the "Unsend" label of a language

Add the exact text of the menu item (lowercase, with its accents) to `UNSEND_TEXT_VARIANTS` in [`src/instagram/messages.js`](../src/instagram/messages.js). The match is exact after normalisation, so a wrong label can only make the item not found, never click another entry. Check the label on a real account in that language before removing the `(unverified)` mark.

The "more options" button is found without its label as well, so it does not need translating.

## Verifying

Set the browser or the `<html lang>` to your language, open a conversation with a few of your messages and check the status line and the menu item. The unit tests only cover the strings and the matching, not the live page.
