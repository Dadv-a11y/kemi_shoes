-- KEMI SHOES — schéma SQLite (miroir fonctionnel de prisma/schema.prisma)
-- Toutes les clés primaires sont des UUID texte générés côté application.

CREATE TABLE IF NOT EXISTS "User" (
  id            TEXT PRIMARY KEY,
  role          TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('CUSTOMER','PRODUCT_MANAGER','ADMIN','DEV')),
  name          TEXT,
  email         TEXT UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  phone         TEXT UNIQUE,
  phoneVerified INTEGER NOT NULL DEFAULT 0,
  passwordHash  TEXT,
  provider      TEXT NOT NULL DEFAULT 'PASSWORD' CHECK (provider IN ('PASSWORD','PHONE_OTP','GOOGLE','FACEBOOK')),
  providerId    TEXT,
  createdAt     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_user_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_user_phone ON "User"(phone);

CREATE TABLE IF NOT EXISTS Address (
  id         TEXT PRIMARY KEY,
  userId     TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  label      TEXT,
  fullName   TEXT NOT NULL,
  phone      TEXT NOT NULL,
  country    TEXT NOT NULL,
  city       TEXT NOT NULL,
  district   TEXT,
  street     TEXT NOT NULL,
  isDefault  INTEGER NOT NULL DEFAULT 0,
  createdAt  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_address_user ON Address(userId);

CREATE TABLE IF NOT EXISTS OtpCode (
  id        TEXT PRIMARY KEY,
  phone     TEXT NOT NULL,
  codeHash  TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  consumed  INTEGER NOT NULL DEFAULT 0,
  attempts  INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON OtpCode(phone);

CREATE TABLE IF NOT EXISTS Product (
  id                   TEXT PRIMARY KEY,
  slugFr               TEXT NOT NULL UNIQUE,
  slugEn               TEXT NOT NULL UNIQUE,
  nameFr               TEXT NOT NULL,
  nameEn               TEXT NOT NULL,
  descriptionFr        TEXT NOT NULL,
  descriptionEn        TEXT NOT NULL,
  category             TEXT NOT NULL,
  price                INTEGER NOT NULL,
  compareAtPrice       INTEGER,
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','out_of_stock')),
  colorCustomizable    INTEGER NOT NULL DEFAULT 1,
  materialCustomizable INTEGER NOT NULL DEFAULT 1,
  createdAt            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_product_category ON Product(category);
CREATE INDEX IF NOT EXISTS idx_product_status ON Product(status);

CREATE TABLE IF NOT EXISTS ProductImage (
  id        TEXT PRIMARY KEY,
  productId TEXT NOT NULL REFERENCES Product(id) ON DELETE CASCADE,
  url       TEXT NOT NULL,
  position  INTEGER NOT NULL DEFAULT 0,
  isMain    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_image_product ON ProductImage(productId);

CREATE TABLE IF NOT EXISTS ProductColor (
  id        TEXT PRIMARY KEY,
  productId TEXT NOT NULL REFERENCES Product(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  hex       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_color_product ON ProductColor(productId);

CREATE TABLE IF NOT EXISTS ProductSize (
  id        TEXT PRIMARY KEY,
  productId TEXT NOT NULL REFERENCES Product(id) ON DELETE CASCADE,
  size      TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 1,
  UNIQUE(productId, size)
);
CREATE INDEX IF NOT EXISTS idx_size_product ON ProductSize(productId);

CREATE TABLE IF NOT EXISTS Review (
  id        TEXT PRIMARY KEY,
  productId TEXT NOT NULL REFERENCES Product(id) ON DELETE CASCADE,
  userId    TEXT REFERENCES "User"(id),
  rating    INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment   TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','hidden')),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_review_product ON Review(productId);
CREATE INDEX IF NOT EXISTS idx_review_status ON Review(status);

CREATE TABLE IF NOT EXISTS DeliveryZone (
  id              TEXT PRIMARY KEY,
  country         TEXT NOT NULL,
  regionOrCity    TEXT,
  feeFcfa         INTEGER NOT NULL,
  etaMinHours     INTEGER NOT NULL,
  etaMaxHours     INTEGER NOT NULL,
  codAvailable    INTEGER NOT NULL DEFAULT 0,
  paymentMethods  TEXT NOT NULL, -- JSON array string
  active          INTEGER NOT NULL DEFAULT 1,
  createdAt       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS "Order" (
  id              TEXT PRIMARY KEY,
  reference       TEXT NOT NULL UNIQUE,
  userId          TEXT REFERENCES "User"(id),
  guestName       TEXT NOT NULL,
  guestPhone      TEXT NOT NULL,
  guestEmail      TEXT,
  deliveryZoneId  TEXT NOT NULL REFERENCES DeliveryZone(id),
  addressCountry  TEXT NOT NULL,
  addressCity     TEXT NOT NULL,
  addressDistrict TEXT,
  addressStreet   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','PREPARING','SHIPPED','DELIVERED','CANCELLED')),
  paymentMethod   TEXT NOT NULL CHECK (paymentMethod IN ('MOBILE_MONEY','CARD','CASH_ON_DELIVERY')),
  paymentStatus   TEXT NOT NULL DEFAULT 'PENDING' CHECK (paymentStatus IN ('PENDING','PAID','FAILED','REFUNDED')),
  paymentRef      TEXT,
  subtotalFcfa    INTEGER NOT NULL,
  deliveryFeeFcfa INTEGER NOT NULL,
  totalFcfa       INTEGER NOT NULL,
  internalNote    TEXT,
  createdAt       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_order_status ON "Order"(status);
CREATE INDEX IF NOT EXISTS idx_order_user ON "Order"(userId);
CREATE INDEX IF NOT EXISTS idx_order_guest_phone ON "Order"(guestPhone);

CREATE TABLE IF NOT EXISTS OrderItem (
  id             TEXT PRIMARY KEY,
  orderId        TEXT NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
  productId      TEXT NOT NULL REFERENCES Product(id),
  productNameFr  TEXT NOT NULL,
  unitPriceFcfa  INTEGER NOT NULL,
  quantity       INTEGER NOT NULL DEFAULT 1,
  size           TEXT NOT NULL,
  color          TEXT,
  customColor    TEXT,
  customMaterial TEXT
);
CREATE INDEX IF NOT EXISTS idx_item_order ON OrderItem(orderId);

CREATE TABLE IF NOT EXISTS OrderStatusEvent (
  id        TEXT PRIMARY KEY,
  orderId   TEXT NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
  status    TEXT NOT NULL,
  note      TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_event_order ON OrderStatusEvent(orderId);

CREATE TABLE IF NOT EXISTS ContentPage (
  id        TEXT PRIMARY KEY,
  slug      TEXT NOT NULL UNIQUE,
  titleFr   TEXT NOT NULL,
  titleEn   TEXT,
  bodyFr    TEXT NOT NULL,
  bodyEn    TEXT,
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS Setting (
  key       TEXT PRIMARY KEY,
  value     TEXT NOT NULL,
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS AuditLog (
  id         TEXT PRIMARY KEY,
  actorId    TEXT REFERENCES "User"(id),
  actorLabel TEXT NOT NULL,
  action     TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId   TEXT,
  metadata   TEXT,
  ip         TEXT,
  createdAt  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_action ON AuditLog(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON AuditLog(entityType, entityId);

CREATE TABLE IF NOT EXISTS Notification (
  id TEXT PRIMARY KEY,
  userId TEXT REFERENCES "User"(id) ON DELETE CASCADE,
  email TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  readAt TIMESTAMPTZ,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notification_user ON Notification(userId, createdAt DESC);
-- Visuels de marque (atelier, fondatrice…) affichés par le site, hors catalogue.
CREATE TABLE IF NOT EXISTS MediaAsset (
  id        TEXT PRIMARY KEY,
  key       TEXT NOT NULL UNIQUE,
  category  TEXT NOT NULL DEFAULT 'brand',
  url       TEXT NOT NULL,
  altFr     TEXT,
  altEn     TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Sessions révocables : chaque connexion crée une session ; le refresh token
-- (rotatif) et l'access token portent son identifiant (sid). Révoquer la session
-- (déconnexion, changement de rôle, suppression du compte) invalide immédiatement
-- les deux jetons.
CREATE TABLE IF NOT EXISTS Session (
  id            TEXT PRIMARY KEY,
  userId        TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  refreshHash   TEXT NOT NULL,
  previousHash  TEXT,
  rotatedAt     TIMESTAMPTZ,
  expiresAt     TIMESTAMPTZ NOT NULL,
  revokedAt     TIMESTAMPTZ,
  createdAt     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastUsedAt    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_session_user ON Session(userId);

-- Rôle DEV (équipe technique : écran de supervision uniquement). La contrainte est
-- recréée pour les bases existantes (CREATE TABLE IF NOT EXISTS ne la modifie pas).
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_role_check";
ALTER TABLE "User" ADD CONSTRAINT "User_role_check" CHECK (role IN ('CUSTOMER','PRODUCT_MANAGER','ADMIN','DEV'));
CREATE INDEX IF NOT EXISTS idx_audit_created ON AuditLog(createdAt DESC);
