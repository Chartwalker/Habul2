/*

dummy bg-modul testing notify-link-clicks-i18n

*/
function notify(message) {
  console.log("background script received message");
  var title = browser.i18n.getMessage("notificationTitle");
  var content = browser.i18n.getMessage("notificationContent", message.url);
  browser.notifications.create({
    "type": "basic",
    "iconUrl": browser.extension.getURL("chrome/skin/icon.png"),
    "title": title,
    "message": content
  });
}

/*

dummy bg-module testing notify-link-clicks-i18n

*/
browser.runtime.onMessage.addListener(notify);