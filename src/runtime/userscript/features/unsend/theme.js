/** @module theme Light/dark theme helpers for the IDMU overlay UI */

export { getTheme, themeColors, applyPanelStyle, applyButtonTheme }

function getTheme(document) {
	const root = document.documentElement
	const body = document.body
	const bg = readCssColor(document, body, "--ig-primary-background")
		|| readCssColor(document, root, "--ig-primary-background")
		|| readCssColor(document, body, "background-color")
		|| ""
	const isDark = isDarkColor(bg)
		|| root.classList.contains("__fb-dark-mode")
		|| body?.classList.contains("__fb-dark-mode")
		|| document.defaultView?.matchMedia?.("(prefers-color-scheme: dark)")?.matches
	return isDark ? "dark" : "light"
}

function readCssColor(document, element, prop) {
	if(!element) return ""
	const view = document.defaultView
	if(!view?.getComputedStyle) return ""
	const value = prop.startsWith("--") ? view.getComputedStyle(element).getPropertyValue(prop) : view.getComputedStyle(element)[prop]
	return (value || "").trim()
}

function isDarkColor(value) {
	const m = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
	if(!m) {
		// Instagram sometimes sets rgb(var(--ig-primary-background)) as "0, 0, 0"
		const parts = String(value).split(",").map(x => Number.parseFloat(x.trim())).filter(x => Number.isFinite(x))
		if(parts.length >= 3) return luminance(parts[0], parts[1], parts[2]) < 0.4
		return false
	}
	return luminance(+m[1], +m[2], +m[3]) < 0.4
}

function luminance(r, g, b) {
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

function themeColors(theme) {
	if(theme === "dark") {
		return {
			panelBg: "rgba(38, 38, 38, 0.96)",
			panelText: "#f5f5f5",
			panelBorder: "rgba(255,255,255,0.12)",
			mutedText: "rgba(245,245,245,0.72)",
			buttonBg: "#0095f6",
			buttonText: "#ffffff",
			buttonSecondaryBg: "rgba(255,255,255,0.12)",
			buttonSecondaryText: "#f5f5f5",
			dangerBg: "#ed4956",
			shadow: "0 8px 24px rgba(0,0,0,0.45)",
			logBg: "rgba(0,0,0,0.2)",
		}
	}
	return {
		panelBg: "rgba(255, 255, 255, 0.97)",
		panelText: "#262626",
		panelBorder: "rgba(0,0,0,0.12)",
		mutedText: "rgba(38,38,38,0.72)",
		buttonBg: "#0095f6",
		buttonText: "#ffffff",
		buttonSecondaryBg: "rgba(0,0,0,0.06)",
		buttonSecondaryText: "#262626",
		dangerBg: "#ed4956",
		shadow: "0 8px 24px rgba(0,0,0,0.18)",
		logBg: "rgba(0,0,0,0.04)",
	}
}

function applyPanelStyle(element, theme) {
	const c = themeColors(theme)
	element.style.background = c.panelBg
	element.style.color = c.panelText
	element.style.border = `1px solid ${c.panelBorder}`
	element.style.boxShadow = c.shadow
	element.style.backdropFilter = "blur(8px)"
}

function applyButtonTheme(button, theme, variant = "primary") {
	const c = themeColors(theme)
	button.style.border = variant === "secondary" ? `1px solid ${c.panelBorder}` : "0"
	button.style.borderRadius = "10px"
	button.style.padding = "8px 12px"
	button.style.fontWeight = "600"
	button.style.fontSize = "14px"
	button.style.lineHeight = "1.2"
	button.style.cursor = "pointer"
	button.style.transition = "filter 120ms ease, transform 120ms ease"
	button.style.background = variant === "primary" ? c.buttonBg : variant === "danger" ? c.dangerBg : c.buttonSecondaryBg
	button.style.color = variant === "secondary" ? c.buttonSecondaryText : c.buttonText
}
