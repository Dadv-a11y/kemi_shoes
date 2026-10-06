import { randomUUID } from 'node:crypto';
import { run } from '../db/client.js';
import { auditLogger } from '../config/logger.js';

/**
 * Enregistre un événement d'audit (changement de statut commande, création produit,
 * changement de rôle, connexion admin...). Écrit à la fois :
 * - en base (table AuditLog) pour interrogation/reporting ultérieur ;
 * - via pino (stream "audit") pour l'agrégation centralisée (ex. Loki/ELK en prod).
 *
 * Ne doit jamais lever d'exception qui bloquerait la requête métier en cours :
 * l'audit est important mais ne doit pas faire échouer l'action elle-même.
 */
export function recordAudit({ actorId = null, actorLabel, action, entityType, entityId = null, metadata = null, ip = null, requestId }) {
  // run() est asynchrone : sans .catch, un échec d'écriture devenait une promesse rejetée non gérée.
  run(
    `INSERT INTO AuditLog (id, actorId, actorLabel, action, entityType, entityId, metadata, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), actorId, actorLabel, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null, ip]
  ).catch((err) => auditLogger.error({ err, action }, 'audit_write_failed'));
  auditLogger.info({ requestId, actorId, actorLabel, action, entityType, entityId }, `audit_event: ${action}`);
}

/**
 * Middleware pratique pour déduire actorId/actorLabel/ip depuis req et logger en une ligne
 * dans un contrôleur : `audit(req, { action: 'product.created', entityType: 'Product', entityId })`.
 */
export function audit(req, { action, entityType, entityId, metadata, actor }) {
  // actor : utilisateur concerné quand req.user n'est pas encore défini (connexion, inscription).
  const who = actor ?? req.user;
  recordAudit({
    actorId: who?.id ?? null,
    actorLabel: who ? `${who.role}:${who.id}` : 'guest',
    action,
    entityType,
    entityId,
    metadata,
    ip: req.ip,
    requestId: req.id,
  });
}