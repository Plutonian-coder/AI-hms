// doGet: required so that redirect-converted GET requests don't return 405.
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: "ok", message: "FUOYE HMS Email Relay is live. Use POST." }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var to = data.to;
    var subject = data.subject;
    var html = data.html;
    var senderName = data.senderName || "FUOYE Hostel Portal";

    // Validate required fields
    if (!to || !subject || !html) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: "error", message: "Missing required fields: to, subject, html" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    MailApp.sendEmail({
      to: to,
      subject: subject,
      htmlBody: html,
      name: senderName
    });

    return ContentService.createTextOutput(JSON.stringify({ status: "success", deliveredTo: to }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
