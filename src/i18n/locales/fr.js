/** French catalog. Keys missing here fall back to English (see ../en.js) */
export const fr = {
	"ui.unsendAll": "Retirer tous les DM",
	"ui.stopProcessing": "Arrêter le traitement",
	"ui.ready": "Prêt",
	"ui.stopping": "Arrêt en cours...",
	"ui.error": "Une erreur est survenue, {url}",

	"workflow.loadingNextPage": "Chargement de la page suivante...",
	"workflow.allPagesLoaded": "Toutes les pages sont chargées ({pages} au total).",
	"workflow.noMessagesRetry": "Aucun message détecté, nouvelle tentative ({attempt}/{max})...",
	"workflow.unsending": "Retrait du message... ({count} retiré(s) jusqu'ici)",
	"workflow.stoppedConsecutive": "Arrêté : {count} échecs consécutifs.",
	"workflow.failedRetry": "Échec ({failures}/{max}), nouvelle tentative dans {seconds} s...",
	"workflow.retrying": "Nouvelle tentative dans {seconds} s ({attempt}/{retries})...",

	"summary.done": { one: "Terminé. {count} message retiré.", other: "Terminé. {count} messages retirés." },
	"summary.aborted": { one: "Interrompu. {count} message retiré.", other: "Interrompu. {count} messages retirés." },
	"summary.errored": { one: "Erreur. {count} message retiré.", other: "Erreur. {count} messages retirés." },
}
