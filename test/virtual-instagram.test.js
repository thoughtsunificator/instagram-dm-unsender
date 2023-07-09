import { test } from "./test.js"
import { createMessageElement, createMessagesWrapperElement, createMessageActionsMenuElement, createDummyMessage } from "./virtual-instagram.js"
import findMessagesStrategy from "../src/ui/strategy/find-messages-strategy.js"
import findMessagesWrapperStrategy from "../src/ui/strategy/find-messages-wrapper-strategy.js"
import loadMoreMessagesStrategy from "../src/ui/strategy/load-more-messages-strategy.js"

test("findMessagesStrategy", async t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	t.context.mountElement.append(messageElement)
	t.deepEqual(await findMessagesStrategy(t.context.document.body), [messageElement])
})

test("findMessagesStrategy ignore if already processed", async t => {
	const messageElement = createMessageElement(t.context.document, "Test", true, true)
	t.context.mountElement.append(messageElement)
	t.deepEqual(await findMessagesStrategy(t.context.document.body), [])
})

test("findMessagesStrategy ignore if unsend button is not found", async t => {
	const messageElement = createMessageElement(t.context.document, "Test", false)
	t.context.mountElement.append(messageElement)
	t.deepEqual(await findMessagesStrategy(t.context.document.body), [])
})

test("findMessagesStrategy multiple", async t => {
	t.context.mountElement.append(...[
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
	t.context.mountElement.append(...[
		createDummyMessage(t.context.document),
		createMessageElement(t.context.document, "Test1", false),
		createMessageElement(t.context.document, "Testdsadsadsac"),
		createDummyMessage(t.context.document),
		createMessageElement(t.context.document, "Test2", false),
		createMessageElement(t.context.document, "xzcxzdsadsadsa"),
		createMessageElement(t.context.document, "Test3", false),
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

test("findMessagesWrapperStrategy", t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.mountElement.append(messagesWrapperElement)
	t.not(findMessagesWrapperStrategy(t.context.window), null)
})

test("createMessageActionsMenuElement", t => {
	const messageActionsMenuElement = createMessageActionsMenuElement(t.context.document)
	t.context.mountElement.append(messageActionsMenuElement)
	t.not(messageActionsMenuElement.querySelector("#unsend"), null)
	t.is(messageActionsMenuElement.querySelector("button"), null)
	messageActionsMenuElement.querySelector("#unsend").click()
	setTimeout(() => {
		t.is(messageActionsMenuElement.querySelector("#unsend"), null)
		t.not(messageActionsMenuElement.querySelector("button"), null)
	})
})

test("createMessageActionsMenuElement click", t => {
	const messageActionsMenuElement = createMessageActionsMenuElement(t.context.document)
	t.context.mountElement.append(messageActionsMenuElement)
	t.not(messageActionsMenuElement.querySelector("#unsend"), null)
	t.is(messageActionsMenuElement.querySelector("button"), null)
	messageActionsMenuElement.querySelector("#unsend").click()
	setTimeout(() => {
		t.is(messageActionsMenuElement.querySelector("#unsend"), null)
		t.not(messageActionsMenuElement.querySelector("button"), null)
	})
})

test("loadMoreMessagesStrategy", async t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document))
	const messagesWrapperElement = findMessagesWrapperStrategy(t.context.window)
	messagesWrapperElement.innerHTML += `<div role="progressbar"></div>`
	const result = loadMoreMessagesStrategy(messagesWrapperElement)
	messagesWrapperElement.querySelector("[role=progressbar]").remove()
	t.is(await result, true)
})


test("loadMoreMessagesStrategy #2", async t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document))
	const messagesWrapperElement = findMessagesWrapperStrategy(t.context.window)
	messagesWrapperElement.innerHTML += `<div role="progressbar"></div>`
	const result = loadMoreMessagesStrategy(messagesWrapperElement)
	messagesWrapperElement.querySelector("[role=progressbar]").remove()
	t.is(await result, true)
})

