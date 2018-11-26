/*
dummy fg-modul testing notify-link-clicks-i18n
*/
function notifyExtension(e) {
  var target = e.target;
  while ((target.tagName != "A" || !target.href) && target.parentNode) {
    target = target.parentNode;
  }
  if (target.tagName != "A")
    return;

  console.log("content script sending message");
  browser.runtime.sendMessage({"url": target.href});
}

/*
dummy fg-modul testing notify-link-clicks-i18n
*/
window.addEventListener("click", notifyExtension);