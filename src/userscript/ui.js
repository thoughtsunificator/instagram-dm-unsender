import IDMU from "../idmu/idmu.js"

const button = document.createElement("button")
button.textContent = "Unsend all DMs"
button.style.position = "fixed"
button.style.top = "10px"
button.style.right = "10px"
button.style.zIndex = 9999
button.addEventListener("click", async () => {
    button.disabled = true
const dmUnsender = new IDMU(window)
    if(!window.dmUnsender) {
      window.dmUnsender = new IDMU(window)
    }
    dmUnsender.unsendMessages()
    
    button.disabled = false
  })

document.body.appendChild(button)
