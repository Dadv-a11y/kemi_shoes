import { z } from 'zod';

const password = z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.');
const phone = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Numéro de téléphone invalide (format E.164, ex. +237600000000).');

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    password,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export const requestOtpSchema = z.object({
  body: z.object({ phone }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone,
    code: z.string().length(6),
    name: z.string().max(120).optional(),
  }),
});

export const refreshSchema = z.object({
  body: z.object({ refreshToken: z.string().min(10) }),
});
export const updateMeSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().optional(),
  }),
});
