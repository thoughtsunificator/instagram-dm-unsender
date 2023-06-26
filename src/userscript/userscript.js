// This script automates the process of unsending DM's on instagram.com
// This script is meant to be run on the page that lists the message threads
// The workflow works as follow:
// - Create a list of all messages by querying on the [role=listbox] selector
//  - For each message another workflow begins:
//      - Over the message node so that the three dots button appears
//      - Click the three dots button to open the message actions
//      - Click the "Unsend" action button, a modal will open with a dialog that asks user to confirm the intent
//      - Click the "Unsend" button inside the modal
// There is no concurrency, message are unsent one after another by using a queue.

import "./ui.js"
