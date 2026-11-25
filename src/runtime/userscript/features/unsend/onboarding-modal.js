/** @module onboarding-modal First-install explanation modal */

import { t } from "../../../../i18n/i18n.js"
import { applyButtonStyle, BUTTON_STYLE } from "./style.js"
import { applyPanelStyle, getTheme, themeColors } from "./theme.js"

export { createOnboardingModal, shouldShowOnboarding, markOnboardingSeen }

const STORAGE_KEY = "idmu_onboarding_seen_v1"

function shouldShowOnboarding(window) {
	try {
		return window.localStorage.getItem(STORAGE_KEY) !== "1"
	} catch {
		return true
	}
}

function markOnboardingSeen(window) {
	try {
		window.localStorage.setItem(STORAGE_KEY, "1")
	} catch {}
}

function createOnboardingModal(document) {
	const window = document.defaultView
	const theme = getTheme(document)
	const c = themeColors(theme)
	const root = document.createElement("div")
	root.id = "idmu-onboarding"
	root.style.position = "fixed"
	root.style.inset = "0"
	root.style.zIndex = "1000"
	root.style.display = "flex"
	root.style.alignItems = "center"
	root.style.justifyContent = "center"
	root.style.background = "rgba(0,0,0,0.45)"
	root.style.padding = "16px"

	const card = document.createElement("div")
	card.style.maxWidth = "560px"
	card.style.width = "100%"
	card.style.padding = "20px"
	card.style.borderRadius = "16px"
	applyPanelStyle(card, theme)

	const title = document.createElement("h2")
	title.textContent = t("ui.onboardingTitle")
	title.style.margin = "0 0 8px"
	title.style.fontSize = "20px"
	const body = document.createElement("p")
	body.textContent = t("ui.onboardingBody")
	body.style.margin = "0 0 12px"
	body.style.lineHeight = "1.45"
	body.style.color = c.panelText

	const list = document.createElement("ul")
	list.style.margin = "0 0 16px"
	list.style.paddingLeft = "20px"
	for(const tip of t("ui.onboardingTips")) {
		const li = document.createElement("li")
		li.textContent = tip
		li.style.marginBottom = "6px"
		list.append(li)
	}

	const actions = document.createElement("div")
	actions.style.display = "flex"
	actions.style.justifyContent = "flex-end"
	const dismiss = document.createElement("button")
	dismiss.textContent = t("ui.onboardingDismiss")
	applyButtonStyle(dismiss, BUTTON_STYLE.PRIMARY)
	dismiss.addEventListener("click", () => {
		markOnboardingSeen(window)
		root.remove()
	})
	actions.append(dismiss)
	card.append(title, body, list, actions)
	root.append(card)
	return { root, dismiss }
}
