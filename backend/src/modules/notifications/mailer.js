import nodemailer from "nodemailer";
import { env, isTest } from "../../config/env.js";
import { logger } from "../../config/logger.js";

let transporter;

/**
 * Construit (une seule fois) le transport SMTP nodemailer à partir des variables
 * d'environnement. En test, on utilise le transport JSON de nodemailer : aucune
 * connexion réseau réelle, le message est simplement sérialisé — ce qui permet de
 * tester le contenu envoyé sans dépendre d'un vrai serveur SMTP.
 */
export function getTransporter() {
  if (transporter) return transporter;

  if (isTest) {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }

  if (!env.SMTP_HOST) {
    logger.warn(
      "SMTP_HOST non configuré — les emails seront écrits dans les logs uniquement.",
    );
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE, // true = TLS direct (port 465), false = STARTTLS (port 587)
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

// Permet aux tests d'injecter un transporteur simulé sans toucher aux variables d'env.
export function setTransporter(customTransporter) {
  transporter = customTransporter;
}

/** SMTP réellement configuré (sinon les e-mails ne sont qu'écrits dans les logs). */
export function isSmtpConfigured() {
  return Boolean(env.SMTP_HOST);
}

/** Paramètres SMTP en vigueur, sans le mot de passe (affichés dans les logs et la supervision). */
export function smtpSummary() {
  return {
    configured: isSmtpConfigured(),
    host: env.SMTP_HOST ?? null,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER ?? null,
    hasPassword: Boolean(env.SMTP_PASS),
    from: env.SMTP_FROM,
  };
}

/**
 * Teste la connexion et l'authentification SMTP (sans envoyer de message).
 * Ne lève jamais : renvoie { ok, error, code } pour être journalisé ou affiché.
 */
export async function checkSmtp() {
  if (!isSmtpConfigured()) return { ok: false, error: 'SMTP_HOST non défini', code: 'NOT_CONFIGURED' };
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message, code: error.code ?? null, responseCode: error.responseCode ?? null };
  }
}

async function send({ to, subject, html, text }) {
  try {
    const info = await getTransporter().sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      text: text ?? html.replace(/<[^>]+>/g, " "),
      html,
    });
    // Sans SMTP_HOST, rien n'est réellement envoyé : le dire explicitement dans les logs.
    logger.info({ to, subject, messageId: info.messageId, delivered: isSmtpConfigured() || isTest }, isSmtpConfigured() ? "email_sent" : "email_not_sent_smtp_not_configured");
    return info;
  } catch (error) {
    logger.error({ to, subject, err: error.message, code: error.code, responseCode: error.responseCode, host: env.SMTP_HOST }, "email_send_failed");
    throw error;
  }
}

export const mailer = {
  send,

  sendOrderConfirmation({ to, reference, totalFcfa, etaLabel }) {
    return send({
      to,
      subject: `KEMI SHOES — Confirmation de commande ${reference}`,
      html: `
        <p>Merci pour votre commande <strong>${reference}</strong> !</p>
        <p>Total : <strong>${totalFcfa.toLocaleString("fr-FR")} FCFA</strong></p>
        <p>Livraison estimée : ${etaLabel}</p>
        <p>Nous vous tiendrons informé(e) de son avancement.</p>
        <p>— L'équipe KEMI SHOES</p>
      `,
    });
  },

  sendOrderStatusUpdate({ to, reference, status }) {
    return send({
      to,
      subject: `KEMI SHOES — Mise à jour de votre commande ${reference}`,
      html: `<p>Votre commande <strong>${reference}</strong> est maintenant : <strong>${status}</strong>.</p>`,
    });
  },

  sendReviewInvitation({
    to,
    reference,
    productName,
    orderDate,
    characteristics,
    reviewUrl,
  }) {
    return send({
      to,
      subject: `KEMI SHOES - Votre avis sur ${productName}`,
      html: `<p>Bonjour,</p><p>Merci pour votre commande <strong>${reference}</strong> du ${orderDate}.</p><p>Vous avez acheté <strong>${productName}</strong>${characteristics ? ` (${characteristics})` : ""}.</p><p>Votre retour nous aiderait beaucoup. Prenez un instant pour partager votre expérience.</p><p><a href="${reviewUrl}">Laisser un avis</a></p><p>Merci pour votre confiance,<br>L'équipe KEMI SHOES</p>`,
    });
  },

  sendEmailVerification({ to, code, ttlMinutes }) {
    return send({
      to,
      subject: `KEMI SHOES — Votre code de vérification : ${code}`,
      html: `<p>Votre code de vérification KEMI SHOES :</p><p style="font-size:28px;letter-spacing:6px"><strong>${code}</strong></p><p>Il est valable ${ttlMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`,
    });
  },

  sendWelcomeEmail({ to, name }) {
    return send({
      to,
      subject: "Bienvenue chez KEMI SHOES",
      html: `<p>Bonjour ${name ?? ""},</p><p>Votre compte KEMI SHOES est créé. Retrouvez vos commandes et suivez vos livraisons à tout moment.</p>`,
    });
  },

  sendPasswordReset({ to, resetUrl }) {
    return send({
      to,
      subject: "KEMI SHOES — Réinitialisation de votre mot de passe",
      html: `<p>Vous avez demandé la réinitialisation de votre mot de passe.</p><p><a href="${resetUrl}">Cliquez ici pour choisir un nouveau mot de passe</a> (valide 30 minutes).</p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
    });
  },
};
