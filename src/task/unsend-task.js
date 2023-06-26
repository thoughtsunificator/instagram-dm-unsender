import Task from "./task.js"

export default class UnsendTask extends Task {


    static SELECTOR_ACTIONS_BUTTON = "[aria-describedby] [role] [aria-label=Unsend], [aria-label=More]"
    static SELECTOR_ACTIONS_MENU = "[style*=translate]"
    static SELECTOR_CONFIRM_MODAL_BUTTON = "[role=dialog] button"

    /**
     *
     * @returns {Promise}`
     */
    run() {
        return new Promise((resolve, reject) => {
            let _observer
            let timeout = setTimeout(() => {
                if(_observer) {
                    _observer.disconnect()
                }
                reject("Workflow failed for messageNode", this.root)
            }, 2500)
            new MutationObserver((mutations, observer) => {
                _observer = observer
                loop:for(const mutation of mutations) {
                    for(const addedNode of mutation.addedNodes) {
                        if(addedNode.nodeType != Node.ELEMENT_NODE) {
                            continue
                        }
                        const threeDotsButton = addedNode.querySelector(UnsendTask.SELECTOR_ACTIONS_BUTTON)
                        if(threeDotsButton) {
                            if(threeDotsButton.click) {
                                threeDotsButton.click()
                            } else{
                                threeDotsButton.parentNode.click()
                            }
                        }
                        if(addedNode.querySelector(SELECTOR_ACTIONS_MENU)) {
                            const button = [...this.window.document.querySelectorAll("div[role] [role]")].pop() // TODO SELECTOR_ACTIONS_MENU_UNSEND_SELECTOR
                            if(button) {
                                if(button.textContent.toLocaleLowerCase() === "unsend") {
                                    button.click()
                                } else {
                                    resolve()
                                }
                            }
                        }
                        const dialogButton = this.window.document.querySelector(UnsendTask.SELECTOR_CONFIRM_MODAL_BUTTON)
                        if(dialogButton) {
                            dialogButton.click()
                            break loop
                        }
                    }
                    for(const removedNode of mutation.removedNodes) {
                        if(removedNode.nodeType != Node.ELEMENT_NODE) {
                            continue
                        }
                        if(removedNode.contains(this.root) || removedNode === this.root) {
                            observer.disconnect()
                            clearTimeout(timeout)
                            resolve()
                        }
                    }
                }
            }).observe(this.window.document.body, { childList: true, subtree: true });
            this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
            this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
            this.root.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
            this.root.setAttribute("data-test", "")
        })
    }
}

