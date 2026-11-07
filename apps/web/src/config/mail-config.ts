// Sender of the sign-in e-mails. EMAIL_FROM is the address the SMTP server (EMAIL_SERVER) is allowed to send
// as; MAILGUN_DOMAIN only matters for the (unused by default) Mailgun helper.
export const mailConfig = {
  fromAdmin: process.env.EMAIL_FROM || "XPAND <no-reply@localhost>",
  domain: process.env.MAILGUN_DOMAIN || "",
};
