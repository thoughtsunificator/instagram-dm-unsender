export {
	UNSEND_TEXT_VARIANTS,
	LABEL_PATTERNS
}

/** Locale-independent patterns for the "Unsend" menu item */
const UNSEND_TEXT_VARIANTS = [
	"unsend",        // English
	"annulla invio", // Italian
	"retirar",       // Portuguese
	"deshacer",      // Spanish
	"retirer",       // French
	"zurücknehmen",  // German
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

