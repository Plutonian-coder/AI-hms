function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var to = data.to;
    var subject = data.subject;
    var html = data.html;
    var senderName = data.senderName || "Hostel Portal";
    
    // Fallback to simple MailApp if GmailApp fails or isn't used
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
