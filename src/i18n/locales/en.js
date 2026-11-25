/**
 * English catalog, the source of truth: every key used by the code must be defined here.
 * Placeholders are written {name}. Plural messages are keyed by CLDR category (one, other, ...).
 */
export const en = {
	"ui.unsendAll": "Unsend all DMs",
	"ui.stopProcessing": "Stop processing",
	"ui.ready": "Ready",
	"ui.stopping": "Stopping...",
	"ui.error": "An error occurred, {url}",

	"workflow.loadingNextPage": "Loading next page...",
	"workflow.allPagesLoaded": "All pages loaded ({pages} in total).",
	"workflow.noMessagesRetry": "No messages detected, retrying ({attempt}/{max})...",
	"workflow.unsending": "Unsending message... ({count} unsent so far)",
	"workflow.stoppedConsecutive": "Stopped: {count} consecutive failures.",
	"workflow.failedRetry": "Failed ({failures}/{max}), retrying in {seconds}s...",
	"workflow.retrying": "Retrying in {seconds}s ({attempt}/{retries})...",

	"summary.done": { one: "Done. {count} message unsent.", other: "Done. {count} messages unsent." },
	"summary.aborted": { one: "Aborted. {count} message unsent.", other: "Aborted. {count} messages unsent." },
	"summary.errored": { one: "Errored. {count} message unsent.", other: "Errored. {count} messages unsent." },
}
