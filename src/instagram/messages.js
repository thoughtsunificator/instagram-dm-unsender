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


/** Represents the description text that is associated with the "..." button that reveals the actions menu */
const LABEL_PATTERNS = [
	"[aria-label^='See more options for message']",
	"[aria-label*='more options']",
	"[aria-label*='More']",
	"[aria-label*='Altre opzioni']",
	"[aria-label*='opzioni']",
	"[aria-label*='opciones']",
	"[aria-label*='options']",
]

