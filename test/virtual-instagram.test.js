import { test } from "./test.js"
import { createMessageElement, createMessagesWrapperElement, createMessageActionsMenuElement, createDummyMessage } from "./virtual-instagram.js"
import findMessagesStrategy from "../src/ui/strategy/find-messages-strategy.js"
import findMessagesWrapperStrategy from "../src/ui/strategy/find-messages-wrapper-strategy.js"
import loadMoreMessagesStrategy from "../src/ui/strategy/load-more-messages-strategy.js"

test("findMessagesStrategy", async t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	t.context.document.body.append(messageElement)
	t.deepEqual(await findMessagesStrategy(t.context.document.body), [messageElement])
})

test("findMessagesStrategy ignore if already processed", async t => {
	const messageElement = createMessageElement(t.context.document, "Test", true, true)
	t.context.document.body.append(messageElement)
	t.deepEqual(await findMessagesStrategy(t.context.document.body), [])
})

test("findMessagesStrategy ignore if unsend button is not found", async t => {
	const messageElement = createMessageElement(t.context.document, "Test", false)
	t.context.document.body.append(messageElement)
	t.deepEqual(await findMessagesStrategy(t.context.document.body), [])
})

test("findMessagesStrategy multiple", async t => {
	t.context.document.body.append(...[
		createMessageElement(t.context.document, "Test", false),
		createMessageElement(t.context.document, "Testdsadsadsac"),
		createMessageElement(t.context.document, "Test", false),
		createMessageElement(t.context.document, "xzcxzdsadsadsa"),
		createMessageElement(t.context.document, "Test", false),
		createMessageElement(t.context.document, "32132xzcxzdsadsadsa"),
	])
	let messageElements = await findMessagesStrategy(t.context.document.body)
	t.is(messageElements.length, 3)
	t.is(messageElements[0].querySelector("span").textContent, "Testdsadsadsac")
	t.is(messageElements[1].querySelector("span").textContent, "xzcxzdsadsadsa")
	t.is(messageElements[2].querySelector("span").textContent, "32132xzcxzdsadsadsa")
	messageElements = await findMessagesStrategy(t.context.document.body)
	t.is(messageElements.length, 3)
	t.is(messageElements[0].querySelector("span").textContent, "Testdsadsadsac")
	t.is(messageElements[1].querySelector("span").textContent, "xzcxzdsadsadsa")
	t.is(messageElements[2].querySelector("span").textContent, "32132xzcxzdsadsadsa")
})

test("findMessagesStrategy multiple dummies", async t => {
	t.context.document.body.append(...[
		createDummyMessage(t.context.document),
		createMessageElement(t.context.document, "Test", false),
		createMessageElement(t.context.document, "Testdsadsadsac"),
		createDummyMessage(t.context.document),
		createMessageElement(t.context.document, "Test", false),
		createMessageElement(t.context.document, "xzcxzdsadsadsa"),
		createMessageElement(t.context.document, "Test", false),
		createMessageElement(t.context.document, "32132xzcxzdsadsadsa"),
	])
	let messageElements = await findMessagesStrategy(t.context.document.body)
	t.is(messageElements.length, 3)
	t.is(messageElements[0].querySelector("span").textContent, "Testdsadsadsac")
	t.is(messageElements[1].querySelector("span").textContent, "xzcxzdsadsadsa")
	t.is(messageElements[2].querySelector("span").textContent, "32132xzcxzdsadsadsa")
	messageElements = await findMessagesStrategy(t.context.document.body)
	t.is(messageElements.length, 3)
	t.is(messageElements[0].querySelector("span").textContent, "Testdsadsadsac")
	t.is(messageElements[1].querySelector("span").textContent, "xzcxzdsadsadsa")
	t.is(messageElements[2].querySelector("span").textContent, "32132xzcxzdsadsadsa")
})

test("findMessagesWrapperStrategy", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.document.body.append(messagesWrapperElement)
	t.deepEqual(await findMessagesWrapperStrategy(t.context.window), messagesWrapperElement)
})

test("createMessageActionsMenuElement", async t => {
	const messageActionsMenuElement = createMessageActionsMenuElement(t.context.document)
	t.context.document.body.append(messageActionsMenuElement)
	t.not(messageActionsMenuElement.querySelector("#unsend"), null)
	t.is(messageActionsMenuElement.querySelector("button"), null)
	messageActionsMenuElement.querySelector("#unsend").click()
	setTimeout(() => {
		t.is(messageActionsMenuElement.querySelector("#unsend"), null)
		t.not(messageActionsMenuElement.querySelector("button"), null)
	})
})

test("createMessageActionsMenuElement click", async t => {
	const messageActionsMenuElement = createMessageActionsMenuElement(t.context.document)
	t.context.document.body.append(messageActionsMenuElement)
	t.not(messageActionsMenuElement.querySelector("#unsend"), null)
	t.is(messageActionsMenuElement.querySelector("button"), null)
	messageActionsMenuElement.querySelector("#unsend").click()
	setTimeout(() => {
		t.is(messageActionsMenuElement.querySelector("#unsend"), null)
		t.not(messageActionsMenuElement.querySelector("button"), null)
	})
})

test("loadMoreMessagesStrategy", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.document.body.append(messagesWrapperElement)
	const result = loadMoreMessagesStrategy(messagesWrapperElement)
	messagesWrapperElement.scrollTop = 1
	messagesWrapperElement.innerHTML += "<div></div>"
	t.is(await result, false)
})

