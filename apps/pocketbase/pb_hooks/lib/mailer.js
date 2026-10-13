function sendMagicLink(app, email, token) {
  const baseUrl = $os.getenv("CF_APP_URL") || "http://localhost:5173";
  const link = baseUrl + "/login?token=" + encodeURIComponent(token);
  const from = $os.getenv("CF_MAIL_FROM") || "no-reply@controle-financeiro.local";
  const message = new MailerMessage({
    from: { address: from, name: "Controle Financeiro Familiar" },
    to: [{ address: email }],
    subject: "Seu link de acesso",
    text: "Use este link para entrar (validade curta, uso único):\n" + link,
    html: "<p>Use este link para entrar (validade curta, uso único):</p><p><a href=\"" + link + "\">Entrar</a></p>",
  });
  const hasSmtp = Boolean($os.getenv("CF_MAIL_HOST"));
  if (hasSmtp) {
    try {
      app.newMailClient().send(message);
    } catch (err) {
      console.log("mail send failed: " + String(err));
    }
  }
  if (!hasSmtp || app.isDev()) {
    console.log("MAGIC_LINK " + email + " -> " + link);
  }
}

function sendSecurityAlert(app, email, subject, text) {
  const from = $os.getenv("CF_MAIL_FROM") || "no-reply@controle-financeiro.local";
  const message = new MailerMessage({
    from: { address: from, name: "Controle Financeiro Familiar" },
    to: [{ address: email }],
    subject: subject,
    text: text,
    html: "<p>" + text + "</p>",
  });
  const hasSmtp = Boolean($os.getenv("CF_MAIL_HOST"));
  if (hasSmtp) {
    try {
      app.newMailClient().send(message);
    } catch (err) {
      console.log("mail send failed: " + String(err));
    }
  }
  if (!hasSmtp || app.isDev()) {
    console.log("SECURITY_MAIL " + email + " | " + subject + " -> " + text);
  }
}

module.exports = { sendMagicLink, sendSecurityAlert };
