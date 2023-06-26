import Task from "./task.js"

export default class ScrollTask extends Task {

    static SELECTOR_PROGRESS_BAR = "[role=progressbar]"

    /**
    * @returns {Promise}
    */
    run() {
       return new Promise(resolve => {
           let loadingPosts = false
           new MutationObserver((mutations, observer) => {
               for(const mutation of mutations) {
                   for(const addedNode of mutation.addedNodes) {
                       if(addedNode.nodeType != Node.ELEMENT_NODE) {
                           continue
                       }
                       if(addedNode.querySelector(ScrollTask.SELECTOR_PROGRESS_BAR)) {
                           loadingPosts = true
                           break
                       }
                   }
               }
               if(!loadingPosts || this.root.scrollTop != 0) {
                   observer.disconnect()
                   resolve()
               }
           }).observe(this.window.document.body, { childList: true, subtree: true, attributes: true });
           this.root.scrollTop = 0
           this.root.setAttribute("data-test", "")
       })
   }
}