import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { env } from '../../config/env.js';
import { findOrCreateOAuthUser } from './auth.service.js';
import { logger } from '../../config/logger.js';

// Passport gère la vérification via un callback classique. L'app reste stateless
// côté serveur (pas de session cookie) : le résultat de findOrCreateOAuthUser
// (access/refresh JWT) est transmis directement à la redirection finale.

export const oauthEnabled = {
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  facebook: Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET),
};

if (oauthEnabled.google) {
  passport.use(new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/v1/auth/oauth/google/callback',
    },
    (accessToken, refreshToken, profile, done) => {
      // findOrCreateOAuthUser est asynchrone : sans attente, le callback recevait
      // une Promise et le front des jetons « undefined ».
      findOrCreateOAuthUser({
        provider: 'GOOGLE',
        providerId: profile.id,
        email: profile.emails?.[0]?.value,
        name: profile.displayName,
      }).then((tokens) => done(null, tokens), done);
    }
  ));
} else {
  logger.warn('OAuth Google désactivé (GOOGLE_CLIENT_ID/SECRET manquants).');
}

if (oauthEnabled.facebook) {
  passport.use(new FacebookStrategy(
    {
      clientID: env.FACEBOOK_APP_ID,
      clientSecret: env.FACEBOOK_APP_SECRET,
      callbackURL: '/api/v1/auth/oauth/facebook/callback',
      profileFields: ['id', 'displayName', 'emails'],
    },
    (accessToken, refreshToken, profile, done) => {
      // findOrCreateOAuthUser est asynchrone : sans attente, le callback recevait
      // une Promise et le front des jetons « undefined ».
      findOrCreateOAuthUser({
        provider: 'FACEBOOK',
        providerId: profile.id,
        email: profile.emails?.[0]?.value,
        name: profile.displayName,
      }).then((tokens) => done(null, tokens), done);
    }
  ));
} else {
  logger.warn('OAuth Facebook désactivé (FACEBOOK_APP_ID/SECRET manquants).');
}

export default passport;