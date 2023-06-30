export default function(window) {
	return [...window.document.querySelector("div + div + div > div").childNodes]
}
