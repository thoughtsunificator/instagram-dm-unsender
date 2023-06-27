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
// @version				0.3.9
// @updateURL				https://raw.githubusercontent.com/thoughtsunificator/instagram-dm-unsender/userscript/idmu.user.js
// @downloadURL				https://raw.githubusercontent.com/thoughtsunificator/instagram-dm-unsender/userscript/idmu.user.js
// @description				Simple script to unsend all DMs in a thread on instagram.com
// @run-at				document-end
// @include				/^https://(www\.)?instagram\.com/direct*/
// ==/UserScript==
window.IDMU_INCLUDE_MEDIA=!0,window.IDMU_MESSAGE_QUEUE_DELAY=1e3,window.IDMU_DRY_RUN=!1,window.IDMU_RETRY=!0,window.IDMU_DEBUG=!1,function(){"use strict";class e{
/**
         * 
         * @param {Node} window 
         * @param {Node} root 
         * @param {*} data 
         */
constructor(e,t,s){this._window=e,this._root=t,this._data=s}get window(){return this._window}get root(){return this._root}get data(){return this._data}
/**
         * @abstract
         * @returns {Promise}
         */run(){throw new Error("run method not implemented")}}class t extends e{static SELECTOR_PROGRESS_BAR="[role=progressbar]"
/**
        * @returns {Promise}
        */;run(){return new Promise((e=>{let s=!1;new MutationObserver(((o,i)=>{for(const e of o)for(const o of e.addedNodes)if(o.nodeType==Node.ELEMENT_NODE&&o.querySelector(t.SELECTOR_PROGRESS_BAR)){s=!0;break}s&&0==this.root.scrollTop||(i.disconnect(),e())})).observe(this.window.document.body,{childList:!0,subtree:!0,attributes:!0}),this.root.scrollTop=0,this.root.setAttribute("data-test","")}))}}class s extends e{static SELECTOR_ACTIONS_BUTTON="[aria-describedby] [role] [aria-label=Unsend], [aria-label=More]";static SELECTOR_ACTIONS_MENU="[style*=translate]";static SELECTOR_CONFIRM_MODAL_BUTTON="[role=dialog] button"
/**
         *
         * @returns {Promise}`
         */;run(){return new Promise(((e,t)=>{let o,i=setTimeout((()=>{o&&o.disconnect(),t("Workflow failed for messageNode",this.root)}),2500);new MutationObserver(((t,r)=>{o=r;e:for(const o of t){for(const t of o.addedNodes){if(t.nodeType!=Node.ELEMENT_NODE)continue;const o=t.querySelector(s.SELECTOR_ACTIONS_BUTTON);if(o&&(o.click?o.click():o.parentNode.click()),t.querySelector(SELECTOR_ACTIONS_MENU)){const t=[...this.window.document.querySelectorAll("div[role] [role]")].pop();// TODO SELECTOR_ACTIONS_MENU_UNSEND_SELECTOR
t&&("unsend"===t.textContent.toLocaleLowerCase()?t.click():e())}const i=this.window.document.querySelector(s.SELECTOR_CONFIRM_MODAL_BUTTON);if(i){i.click();break e}}for(const t of o.removedNodes)t.nodeType==Node.ELEMENT_NODE&&(t.contains(this.root)||t===this.root)&&(r.disconnect(),clearTimeout(i),e())}})).observe(this.window.document.body,{childList:!0,subtree:!0}),this.root.dispatchEvent(new MouseEvent("mousemove",{bubbles:!0})),this.root.dispatchEvent(new MouseEvent("mouseover",{bubbles:!0})),this.root.dispatchEvent(new MouseEvent("mouseenter",{bubbles:!0})),this.root.setAttribute("data-test","")}))}}class o{constructor(){this.lastPromise=null}
/**
         *
         * @param {UnsendTask} task
         * @returns {Promise}
         */add(e,t=0,s){return this.lastPromise?this.lastPromise=this.lastPromise.then((()=>new Promise((o=>{setTimeout((()=>e.run().then(o).catch((()=>{s&&this.add(e,t,s),o()}))),t)})))):this.lastPromise=e.run(),this.lastPromise}}class i{static SELECTOR_MESSAGE_WRAPPER='div > textarea[dir=auto], div[aria-label="Message"]';static SELECTOR_TEXT_MESSAGE="div[role] div[role=button] div[dir=auto]";static SELECTOR_MEDIA_MESSAGE="div[role] div[role=button] div > img";static SELECTOR_EMOJI_MESSAGE="div[role] div[role=button] > svg";static SELECTOR_EMOJI2_MESSAGE="div[role] div[role=button] div > p > span";constructor(e){this.window=e,this.messagesWrapperNode=e.document.querySelector(i.SELECTOR_MESSAGE_WRAPPER).parentNode.parentNode.parentNode.parentNode.parentNode?.parentNode.firstElementChild.firstElementChild.firstElementChild,null!=this.messagesWrapperNode.getAttribute("arial-label")&&(this.messagesWrapperNode=this.messagesWrapperNode.firstElementChild.firstElementChild.firstElementChild.firstElementChild)}async loadMessages(){const e=new o;await e.add(new t(this.window,this.messagesWrapperNode),this.window.IDMU_RETRY),0!=this.messagesWrapperNode.scrollTop&&await this.loadMessages()}async getMessageNodes(){await this.loadMessages();let e=[...this.messagesWrapperNode.querySelectorAll(i.SELECTOR_TEXT_MESSAGE)].filter((e=>1==e.childNodes.length&&e.firstChild.nodeType==Node.TEXT_NODE)).map((e=>e.parentNode.parentNode));return this.window.IDMU_INCLUDE_MEDIA&&(e=e.concat([...this.messagesWrapperNode.querySelectorAll(i.SELECTOR_MEDIA_MESSAGE)].map((e=>e.parentNode.parentNode)))),e=e.concat([...this.messagesWrapperNode.querySelectorAll(i.SELECTOR_EMOJI_MESSAGE)].map((e=>e.parentNode.parentNode))),e=e.concat([...this.messagesWrapperNode.querySelectorAll(i.SELECTOR_EMOJI2_MESSAGE)].map((e=>e.parentNode.parentNode))),e}async unsendMessages(){const e=new o(this.window.IDMU_MESSAGE_QUEUE_DELAY),t=await this.getMessageNodes();for(const o of t)await e.add(new s(this.window,o),this.window.IDMU_MESSAGE_QUEUE_DELAY,this.window.IDMU_RETRY)}}const r=new i(window),n=document.createElement("button");n.textContent="Unsend all DMs",n.style.position="fixed",n.style.top="10px",n.style.right="10px",n.style.zIndex=9999,n.addEventListener("click",(async()=>{n.disabled=!0,r.unsendMessages(),n.disabled=!1})),document.body.appendChild(n)}();
