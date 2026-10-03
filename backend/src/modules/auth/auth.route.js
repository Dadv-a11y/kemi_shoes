import { Router } from 'express';
import passport, { oauthEnabled } from './oauth.js';
import * as controller from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter, otpRequestLimiter } from '../../middleware/rateLimit.js';
import { env } from '../../config/env.js';

import {
  registerSchema, loginSchema, requestOtpSchema, verifyOtpSchema, refreshSchema, updateMeSchema,
} from './auth.schema.js';

// Le callback OAuth renvoie le navigateur vers le frontend avec les tokens dans
// le fragment d'URL (#...) : jamais transmis au serveur ni journalisé.
function redirectToFrontend(req, res) {
  const { accessToken, refreshToken } = req.user;
  const fragment = new URLSearchParams({ accessToken, refreshToken }).toString();
  res.redirect(`${env.FRONTEND_URL}/fr/compte/connexion#${fragment}`);
}

const failureRedirect = `${env.FRONTEND_URL}/fr/compte/connexion#error=oauth`;

const router = Router();

// --- Email + mot de passe ---
router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);

// --- Téléphone + OTP (méthode principale pour la clientèle locale) ---
router.post('/otp/request', otpRequestLimiter, validate(requestOtpSchema), controller.requestOtp);
router.post('/otp/verify', authLimiter, validate(verifyOtpSchema), controller.verifyOtp);

// --- Session ---
router.post('/refresh', validate(refreshSchema), controller.refresh);
router.get('/me', requireAuth, controller.me);
router.patch('/me', requireAuth, validate(updateMeSchema), controller.updateMe);
router.delete('/me', requireAuth, controller.deleteMe);

// Liste des fournisseurs OAuth actifs — le frontend n'affiche que ceux-là.
router.get('/providers', (req, res) => res.json(oauthEnabled));

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