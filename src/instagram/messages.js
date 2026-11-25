export {
	UNSEND_TEXT_VARIANTS,
	LABEL_PATTERNS
}

/**
 * Labels of the "Unsend" menu item, one per UI language Instagram is known to ship.
 * Matching is an exact, case-insensitive comparison of the whole menu entry, so an unknown or wrong
 * label only means the item is not found (the message is skipped), never that another item is clicked.
 * Add the label of any missing language here. Entries marked (unverified) were not checked on a live account.
 */
const UNSEND_TEXT_VARIANTS = [
	"unsend",            // English
	"annulla invio",     // Italian
	"retirar",           // Portuguese
	"deshacer",          // Spanish
	"retirer",           // French
	"zurücknehmen",      // German
	"ongedaan maken",    // Dutch (unverified)
	"cofnij wysłanie",   // Polish (unverified)
	"отменить отправку", // Russian (unverified)
	"скасувати надсилання", // Ukrainian (unverified)
	"gönderimi geri al", // Turkish (unverified)
	"送信を取り消す",      // Japanese (unverified)
	"전송 취소",          // Korean (unverified)
	"撤回",              // Chinese, Simplified (unverified)
	"收回",              // Chinese, Traditional (unverified)
	"batalkan pengiriman", // Indonesian (unverified)
	"thu hồi",           // Vietnamese (unverified)
	"ביטול שליחה",        // Hebrew (unverified)
	"إلغاء الإرسال",      // Arabic (unverified)
]


/**
 * Words found in the aria-label of the "..." (more options) button, one per UI language, matched as substrings.
 * The button is also found without any of them (see findActionButton), so a missing word only costs a fallback lookup.
 * Entries marked (unverified) were not checked on a live account.
 */
const MORE_OPTIONS_LABELS = [
	"more options",
	"More",
	"options",
	"Altre opzioni",     // Italian
	"opzioni",           // Italian
	"opciones",          // Spanish
	"Plus d'options",    // French (unverified)
	"Mais opções",       // Portuguese (unverified)
	"Weitere Optionen",  // German (unverified)
	"Więcej opcji",      // Polish (unverified)
	"Meer opties",       // Dutch (unverified)
	"Daha fazla seçenek", // Turkish (unverified)
	"Дополнительные",    // Russian (unverified)
	"更多选项",           // Chinese, Simplified (unverified)
	"その他のオプション",    // Japanese (unverified)
	"옵션 더보기",         // Korean (unverified)
]

/**
 * Selectors of the "..." (more options) button, built from the localized words above.
 * Single quotes are escaped so that a label can be written as is.
 */
const LABEL_PATTERNS = [
	"[aria-label^='See more options for message']",
	...MORE_OPTIONS_LABELS.map(label => `[aria-label*='${label.replace(/'/g, "\\'")}']`),
]

