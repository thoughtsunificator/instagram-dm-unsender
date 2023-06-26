import test from 'ava'
import { JSDOM } from 'jsdom'

import SAMPLE_FRANCE_PAGE_HTML from "./sample/france/page.js"
import SAMPLE_USA_RECEIVE_HTML from "./sample/usa/receive.js"

import IDMU from "../src/idmu/idmu.js"

global.MutationObserver = new JSDOM().window.MutationObserver
global.Node = new JSDOM().window.Node
global.MouseEvent = new JSDOM().window.MouseEvent

test.beforeEach(t => {
    const virtualDOM = new JSDOM().window
    const { document } = virtualDOM.window
    t.context.document = document
    t.context.window = virtualDOM.window
    t.context.window.IDMU_INCLUDE_MEDIA = true
    t.context.window.IDMU_MESSAGE_QUEUE_DELAY = 0
    t.context.window.IDMU_DRY_RUN = false
    t.context.window.IDMU_RETRY = false
})

test('Simple run with SAMPLE_FRANCE_PAGE_HTML', t => {
    t.notThrows(async () => {
        t.context.document.body.innerHTML = SAMPLE_FRANCE_PAGE_HTML
        await new IDMU(t.context.window).unsendMessages()
    })
})

test('Count messages in SAMPLE_FRANCE_PAGE_HTML IDMU_INCLUDE_MEDIA=true', async t => {
    t.context.document.body.innerHTML = SAMPLE_FRANCE_PAGE_HTML
    t.context.window.IDMU_INCLUDE_MEDIA = true
    const messageNodes = await new IDMU(t.context.window).getMessageNodes()
    t.is(messageNodes.length, 11)
})

test('Count messages in SAMPLE_FRANCE_PAGE_HTML IDMU_INCLUDE_MEDIA=false', async t => {
    t.context.document.body.innerHTML = SAMPLE_FRANCE_PAGE_HTML
    t.context.window.IDMU_INCLUDE_MEDIA = false
    const messageNodes = await new IDMU(t.context.window).getMessageNodes()
    t.is(messageNodes.length, 10)
})

test('Count messages in SAMPLE_USA_RECEIVE_HTML IDMU_INCLUDE_MEDIA=true', async t => {
    t.context.document.body.innerHTML = SAMPLE_USA_RECEIVE_HTML
    t.context.window.IDMU_INCLUDE_MEDIA = false
    const messageNodes = await new IDMU(t.context.window).getMessageNodes()
    t.is(messageNodes.length, 9)
})
