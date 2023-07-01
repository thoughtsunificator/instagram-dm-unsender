export default async function(uiMessagesWrapper) {
	return [...uiMessagesWrapper.root.querySelector("div + div + div > div").childNodes]
}
