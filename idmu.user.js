
// ==UserScript==

// @name				instagram-dm-unsender
// @license				MIT
// @copyright				Copyright (c) 2023, Romain Lebesle <oss@thoughtsunificator.me> (https://thoughtsunificator.me)
// @namespace				https://thoughtsunificator.me/
// @author				Romain Lebesle <oss@thoughtsunificator.me> (https://thoughtsunificator.me)
// @homepageURL				https://thoughtsunificator.me/
// @supportURL				https://thoughtsunificator.me/
// @contributionURL				https://thoughtsunificator.me/
// @icon				https://www.instagram.com/favicon.ico
// @version				0.4.3
// @updateURL				https://raw.githubusercontent.com/thoughtsunificator/instagram-dm-unsender/userscript/idmu.user.js
// @downloadURL				https://raw.githubusercontent.com/thoughtsunificator/instagram-dm-unsender/userscript/idmu.user.js
// @description				Simple script to unsend all DMs in a thread on instagram.com
// @run-at				document-end
// @include				/^https://(www\.)?instagram\.com/direct*/

// ==/UserScript==


;(function() {
	window["IDMU_INCLUDE_MEDIA"] = true
	window["IDMU_MESSAGE_QUEUE_DELAY"] = 1000
	window["IDMU_DRY_RUN"] = false
	window["IDMU_RETRY"] = true
	window["IDMU_DEBUG"] = false
})();
(function () {
    'use strict';

    class Task {
        /**
         * 
         * @param {Node} window 
         * @param {Node} root 
         * @param {*} data 
         */
        constructor(window, root, data) {
            this._window = window;
            this._root = root;
            this._data = data;
        }
        get window() {
            return this._window
        }
        get root() {
            return this._root
        }

        get data() {
            return this._data
        }
        /**
         * @abstract
         * @returns {Promise}
         */
        run() {
            throw new Error("run method not implemented")
        }
    }

    class ScrollTask extends Task {

        static SELECTOR_PROGRESS_BAR = "[role=progressbar]"

        /**
        * @returns {Promise}
        */
        run() {
           return new Promise(resolve => {
               let loadingPosts = false;
               new MutationObserver((mutations, observer) => {
                   for(const mutation of mutations) {
                       for(const addedNode of mutation.addedNodes) {
                           if(addedNode.nodeType != Node.ELEMENT_NODE) {
                               continue
                           }
                           if(addedNode.querySelector(ScrollTask.SELECTOR_PROGRESS_BAR)) {
                               loadingPosts = true;
                               break
                           }
                       }
                   }
                   if(!loadingPosts || this.root.scrollTop != 0) {
                       observer.disconnect();
                       resolve();
                   }
               }).observe(this.window.document.body, { childList: true, subtree: true, attributes: true });
               this.root.scrollTop = 0;
               this.root.setAttribute("data-test", "");
           })
       }
    }

    class UnsendTask extends Task {


        static SELECTOR_ACTIONS_BUTTON = "[aria-describedby] [role] [aria-label=Unsend], [aria-label=More]"
        static SELECTOR_ACTIONS_MENU = "[style*=translate]"
        static SELECTOR_CONFIRM_MODAL_BUTTON = "[role=dialog] button"

        /**
         *
         * @returns {Promise}`
         */
        run() {
            return new Promise((resolve, reject) => {
                let _observer;
                let timeout = setTimeout(() => {
                    if(_observer) {
                        _observer.disconnect();
                    }
                    reject("Workflow failed for messageNode", this.root);
                }, 2500);
                new MutationObserver((mutations, observer) => {
                    _observer = observer;
                    loop:for(const mutation of mutations) {
                        for(const addedNode of mutation.addedNodes) {
                            if(addedNode.nodeType != Node.ELEMENT_NODE) {
                                continue
                            }
                            const threeDotsButton = addedNode.querySelector(UnsendTask.SELECTOR_ACTIONS_BUTTON);
                            if(threeDotsButton) {
                                if(threeDotsButton.click) {
                                    threeDotsButton.click();
                                } else {
                                    threeDotsButton.parentNode.click();
                                }
                            }
                            if(addedNode.querySelector(UnsendTask,SELECTOR_ACTIONS_MENU)) {
                                const button = [...this.window.document.querySelectorAll("div[role] [role]")].pop(); // TODO SELECTOR_ACTIONS_MENU_UNSEND_SELECTOR
                                if(button) {
                                    if(button.textContent.toLocaleLowerCase() === "unsend") {
                                        button.click();
                                    } else {
                                        resolve();
                                    }
                                }
                            }
                            const dialogButton = this.window.document.querySelector(UnsendTask.SELECTOR_CONFIRM_MODAL_BUTTON);
                            if(dialogButton) {
                                dialogButton.click();
                                break loop
                            }
                        }
                        for(const removedNode of mutation.removedNodes) {
                            if(removedNode.nodeType != Node.ELEMENT_NODE) {
                                continue
                            }
                            if(removedNode.contains(this.root) || removedNode === this.root) {
                                observer.disconnect();
                                clearTimeout(timeout);
                                resolve();
                            }
                        }
                    }
                }).observe(this.window.document.body, { childList: true, subtree: true });
                this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
                this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
                this.root.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
                this.root.setAttribute("data-test", "");
            })
        }
    }

    class Queue {
        constructor() {
            this.lastPromise = null;
        }
        /**
         *
         * @param {UnsendTask} task
         * @returns {Promise}
         */
        add(task, delay=0, retry) {
            if(this.lastPromise) {
                this.lastPromise = this.lastPromise.then(() => new Promise(resolve => {
                    setTimeout(() => task.run().then(resolve).catch(() => {
                        if(retry) {
                            this.add(task, delay, retry);
                        }
                        resolve();
                    }), delay);
                }));
            } else {
                this.lastPromise = task.run();
            }
            return this.lastPromise
        }
     }

    class IDMU {

        static SELECTOR_MESSAGE_WRAPPER = 'div > textarea[dir=auto], div[aria-label="Message"]'
        static SELECTOR_TEXT_MESSAGE = "div[role] div[role=button] div[dir=auto]"
        static SELECTOR_MEDIA_MESSAGE = "div[role] div[role=button] div > img"
        static SELECTOR_EMOJI_MESSAGE = "div[role] div[role=button] > svg"
        static SELECTOR_EMOJI2_MESSAGE = "div[role] div[role=button] div > p > span"

        constructor(window) {
            this.window = window;
            this.messagesWrapperNode = window.document.querySelector(IDMU.SELECTOR_MESSAGE_WRAPPER).parentNode.parentNode.parentNode.parentNode.parentNode?.parentNode.firstElementChild.firstElementChild.firstElementChild;
            if(this.messagesWrapperNode.getAttribute("arial-label") != null) {
                this.messagesWrapperNode = this.messagesWrapperNode.firstElementChild.firstElementChild.firstElementChild.firstElementChild;
            }
        }

        async loadMessages() {
            const queue = new Queue();
            await queue.add(new ScrollTask(this.window, this.messagesWrapperNode), this.window.IDMU_RETRY);
            if(this.messagesWrapperNode.scrollTop != 0) {
                await this.loadMessages();
            } 
        }

        async getMessageNodes() {
            await this.loadMessages();
            let messageNodes = [...this.messagesWrapperNode.querySelectorAll(IDMU.SELECTOR_TEXT_MESSAGE)].filter(node => node.childNodes.length == 1 && node.firstChild.nodeType == Node.TEXT_NODE).map(node => node.parentNode.parentNode);
            if(this.window.IDMU_INCLUDE_MEDIA) {
                messageNodes = messageNodes.concat([...this.messagesWrapperNode.querySelectorAll(IDMU.SELECTOR_MEDIA_MESSAGE)].map(node => node.parentNode.parentNode));
            }
            messageNodes = messageNodes.concat([...this.messagesWrapperNode.querySelectorAll(IDMU.SELECTOR_EMOJI_MESSAGE)].map(node => node.parentNode.parentNode));
            messageNodes = messageNodes.concat([...this.messagesWrapperNode.querySelectorAll(IDMU.SELECTOR_EMOJI2_MESSAGE)].map(node => node.parentNode.parentNode));
            return messageNodes
        }

        async unsendMessages() {
            const queue = new Queue(this.window.IDMU_MESSAGE_QUEUE_DELAY);
            const messageNodes = await this.getMessageNodes();
            for(const messageNode of messageNodes) {
                await queue.add(new UnsendTask(this.window, messageNode), this.window.IDMU_MESSAGE_QUEUE_DELAY, this.window.IDMU_RETRY);
            }
        }

    }

    const button = document.createElement("button");
    button.textContent = "Unsend all DMs";
    button.style.position = "fixed";
    button.style.top = "10px";
    button.style.right = "10px";
    button.style.zIndex = 9999;
    button.addEventListener("click", async () => {
        button.disabled = true;
    const dmUnsender = new IDMU(window);
        if(!window.dmUnsender) {
          window.dmUnsender = new IDMU(window);
        }
        dmUnsender.unsendMessages();
        
        button.disabled = false;
      });

    document.body.appendChild(button);

})();
