import ScrollTask from "../task/scroll-task.js"
import UnsendTask from "../task/unsend-task.js"
import Queue from "./queue.js"

export default class IDMU {

    static SELECTOR_MESSAGE_WRAPPER = 'div > textarea[dir=auto], div[aria-label="Message"]'
    static SELECTOR_TEXT_MESSAGE = "div[role] div[role=button] div[dir=auto]"
    static SELECTOR_MEDIA_MESSAGE = "div[role] div[role=button] div > img"
    static SELECTOR_EMOJI_MESSAGE = "div[role] div[role=button] > svg"
    static SELECTOR_EMOJI2_MESSAGE = "div[role] div[role=button] div > p > span"

    constructor(window) {
        this.window = window
        this.messagesWrapperNode = window.document.querySelector(IDMU.SELECTOR_MESSAGE_WRAPPER).parentNode.parentNode.parentNode.parentNode.parentNode?.parentNode.firstElementChild.firstElementChild.firstElementChild
        if(this.messagesWrapperNode.getAttribute("arial-label") != null) {
            this.messagesWrapperNode = this.messagesWrapperNode.firstElementChild.firstElementChild.firstElementChild.firstElementChild
        }
    }

    async loadMessages() {
        const queue = new Queue()
        await queue.add(new ScrollTask(this.window, this.messagesWrapperNode), this.window.IDMU_RETRY)
        if(this.messagesWrapperNode.scrollTop != 0) {
            await this.loadMessages()
        } 
    }

    async getMessageNodes() {
        await this.loadMessages()
        let messageNodes = [...this.messagesWrapperNode.querySelectorAll(IDMU.SELECTOR_TEXT_MESSAGE)].filter(node => node.childNodes.length == 1 && node.firstChild.nodeType == Node.TEXT_NODE).map(node => node.parentNode.parentNode)
        if(this.window.IDMU_INCLUDE_MEDIA) {
            messageNodes = messageNodes.concat([...this.messagesWrapperNode.querySelectorAll(IDMU.SELECTOR_MEDIA_MESSAGE)].map(node => node.parentNode.parentNode))
        }
        messageNodes = messageNodes.concat([...this.messagesWrapperNode.querySelectorAll(IDMU.SELECTOR_EMOJI_MESSAGE)].map(node => node.parentNode.parentNode))
        messageNodes = messageNodes.concat([...this.messagesWrapperNode.querySelectorAll(IDMU.SELECTOR_EMOJI2_MESSAGE)].map(node => node.parentNode.parentNode))
        return messageNodes
    }

    async unsendMessages() {
        const queue = new Queue(this.window.IDMU_MESSAGE_QUEUE_DELAY)
        const messageNodes = await this.getMessageNodes()
        for(const messageNode of messageNodes) {
            await queue.add(new UnsendTask(this.window, messageNode), this.window.IDMU_MESSAGE_QUEUE_DELAY, this.window.IDMU_RETRY)
        }
    }

}