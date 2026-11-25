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
	"ui.progress": "{unsent} unsent · {failures} failed",
	"ui.whatsNew": "What's new",
	"ui.close": "Close",
	"ui.noChanges": "No changes recorded yet.",
	"ui.debug": "Debug",
	"ui.copyDebug": "Copy debug report",
	"ui.debugCopied": "Debug report copied",
	"ui.debugCopyFailed": "Could not copy debug report",
	"ui.debugEmpty": "No debug entries yet.",
	"ui.debugSnapshot": "Snapshot DOM",
	"ui.debugClear": "Clear",
	"ui.onboardingTitle": "Welcome to instagram-dm-unsender",
	"ui.onboardingBody": "This tool helps you unsend your own messages in the currently open Instagram DM thread. It works by automating the same UI steps you would do manually (open message options, click Unsend, confirm).",
	"ui.onboardingTips": ["Open the DM thread you want to clean up.","Click \"Unsend all DMs\" to start, and \"Stop processing\" to stop anytime.","Instagram may rate-limit unsending; failures are retried with backoff.","If something fails, open Debug and copy the debug report."],
	"ui.onboardingDismiss": "Got it",

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
