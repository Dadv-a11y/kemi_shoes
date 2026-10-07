import { Router } from 'express';
import passport, { oauthEnabled } from './oauth.js';
import * as controller from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter, otpRequestLimiter } from '../../middleware/rateLimit.js';
import { env } from '../../config/env.js';
import { isPhoneAuthAvailable } from '../notifications/sms/sms.factory.js';
import { setAuthCookies } from './cookies.js';
import { emailVerificationMode } from './emailCode.service.js';

import {
  registerSchema, loginSchema, requestEmailSchema, verifyEmailSchema, requestOtpSchema, verifyOtpSchema, refreshSchema, updateMeSchema,
} from './auth.schema.js';

// Callback OAuth : la session est posée en cookies HttpOnly, puis retour sur le frontend
// (le fragment ne contient aucun jeton, seulement le signal « connecté »).
function redirectToFrontend(req, res) {
  setAuthCookies(res, req.user);
  res.redirect(`${env.FRONTEND_URL}/fr/compte/connexion#signedIn=1`);
}

const failureRedirect = `${env.FRONTEND_URL}/fr/compte/connexion#error=oauth`;

const router = Router();

// --- Email + mot de passe ---
router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);

// --- Vérification de l'adresse e-mail (code à 6 chiffres) ---
router.post('/email/resend', otpRequestLimiter, validate(requestEmailSchema), controller.resendEmailCode);
router.post('/email/verify', authLimiter, validate(verifyEmailSchema), controller.verifyEmailCode);

// --- Téléphone + OTP (méthode principale pour la clientèle locale) ---
router.post('/otp/request', otpRequestLimiter, validate(requestOtpSchema), controller.requestOtp);
router.post('/otp/verify', authLimiter, validate(verifyOtpSchema), controller.verifyOtp);

// --- Session ---
router.post('/refresh', validate(refreshSchema), controller.refresh);
// Révocation côté serveur : la session courante, ou toutes celles du compte.
router.post('/logout', controller.logout);
router.post('/logout-all', requireAuth, controller.logoutAll);
router.get('/me', requireAuth, controller.me);
router.patch('/me', requireAuth, validate(updateMeSchema), controller.updateMe);
router.delete('/me', requireAuth, controller.deleteMe);

// Liste des fournisseurs OAuth actifs — le frontend n'affiche que ceux-là.
// Seules les méthodes réellement configurées sont proposées par le frontend.
router.get('/providers', (req, res) => res.json({ password: true, emailVerification: emailVerificationMode() === 'on', phone: isPhoneAuthAvailable(), ...oauthEnabled }));

// --- OAuth Google / Facebook (actives seulement si les identifiants sont configurés) ---
if (oauthEnabled.google) {
  router.get('/oauth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
  router.get('/oauth/google/callback',
    passport.authenticate('google', { session: false, failureRedirect }),
    redirectToFrontend // req.user = { accessToken, refreshToken, user } via findOrCreateOAuthUser
  );
}
if (oauthEnabled.facebook) {
  router.get('/oauth/facebook', passport.authenticate('facebook', { scope: ['email'], session: false }));
  router.get('/oauth/facebook/callback',
    passport.authenticate('facebook', { session: false, failureRedirect }),
    redirectToFrontend
  );
}
router.get('/oauth/failure', (req, res) => {
  res.status(401).json({ error: { code: 'OAUTH_FAILED', message: 'Authentification échouée.' } });
});

export default router;