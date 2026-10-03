# Prompt d'implémentation — KEMI SHOES (e-commerce Next.js)

> Ce document est destiné à un agent de code (Claude Code ou équivalent). Il compile l'ensemble des décisions de marque, produit, UX et techniques prises avec Nexa Digital Lab pour le site e-commerce de KEMI SHOES. Traite chaque section comme une spécification à implémenter, pas comme une simple suggestion. En cas d'ambiguïté non tranchée ici, choisis l'option la plus simple à faire évoluer plus tard et signale le choix fait.

---

## 1. Contexte produit

KEMI SHOES est une marque camerounaise de sandales en cuir haut de gamme, fabriquées à la main à Douala (pk11). Positionnement : luxe accessible africain — artisanat de qualité, matériaux nobles, finitions comparables aux maisons de luxe occidentales, avec une fierté assumée du savoir-faire local. La marque a déjà une communauté active (78K abonnés Facebook) et vend actuellement via WhatsApp/Facebook/Instagram ; ce site e-commerce est une professionnalisation de ce canal, pas un lancement à froid.

Cible : hommes et femmes urbains 25–45 ans au Cameroun et dans la diaspora, sensibles au statut social et à l'authenticité artisanale.

ses reseaux : [facebook](https://web.facebook.com/ischristdiamal0) ,
[instagram](https://www.instagram.com/kemi_shoes_237),[whatsapp](+237 6 78 66 60 69) 
---

## 2. Stack technique imposée

- **Next.js 16.3.0**, App Router.
- **TypeScript** strict sur l'ensemble du projet.
- **React Server Components en priorité absolue.** Un composant ne passe en Client Component (`"use client"`) que s'il a une raison précise de le faire (state local, écouteurs d'événements, animations interactives, hooks navigateur). Les fetchs de données, la composition de layout et tout ce qui ne nécessite pas d'interactivité restent en Server Components. Les îlots interactifs (sélecteurs de taille/couleur, tiroir de filtres, stepper de checkout, etc.) doivent être des Client Components isolés et le plus petits possible, insérés dans des arbres Server Components — jamais l'inverse (ne pas rendre un layout entier client pour un seul bouton interactif).
- **Server Actions** pour les mutations (ajout au panier, soumission de commande, création de compte, formulaires admin) plutôt que des routes API exposées quand c'est possible.
- **shadcn/ui** pour les composants d'interface (dialogs, sheets/drawers, form primitives, dropdown, tabs, accordion, toast). Les [composants shadcn](/components/ui/) doivent être stylés avec les tokens de marque définis en section 4, pas laissés dans leur thème par défaut.
- **Tailwind CSS**  configuré dans [global.css](/app/globals.css)  avec les tokens de couleur et de typographie de la marque.
- (**next-international**)[https://next-international.vercel.app/docs]  pour l'internationalisation — voir section 6.
- Base de données et ORM au choix de l'agent selon l'écosystème Next.js (ex. Prisma + PostgreSQL), mais le schéma doit refléter les modèles de données décrits en section 8.
- Images via `next/image` systématiquement, jamais de balises `<img>` brutes pour le contenu produit.

---

## 3. Priorités transverses non négociables

1. **SEO pensé dès l'architecture**, pas ajouté après coup (détail section 7).
2. **Internationalisation FR/EN dès la structure de routes**, pas une traduction ajoutée plus tard (détail section 6).
3. **Mobile-first** sur toutes les pages boutique (le site map et les maquettes ont été conçus mobile-first ; le desktop est une extension, pas l'inverse).
4. **Aucune animation lourde** : transitions simples (fondu, léger zoom au survol, translation courte), jamais de scroll-jacking ni de parallax marqué.
5. **Accessibilité de base** : `prefers-reduced-motion` respecté partout où il y a une animation en boucle (voir le carrousel mobile de la hero), contrastes suffisants, navigation clavier fonctionnelle sur les tiroirs/modales.
6. **Architecture des paiements et de la livraison en interfaces découplées** (détail section 8) — l'agent ne doit jamais coder un appel direct à un agrégateur de paiement dans la logique métier.

---

## 4. Design system — à respecter à la lettre

Les fichiers HTML haute-fidélité livrés précédemment (accueil, catalogue, fiche produit, panier, checkout, connexion) font foi pour le détail visuel exact de chaque page. Cette section résume les tokens à extraire et industrialiser en variables Tailwind/CSS.

### 4.1 Couleurs

```
--void:       #000000   (fond header/footer/hero, noir pur)
--ink:        #14120F   (texte principal, noir chaud)
--terracotta: #D2531E   (CTA principal, accents, couleur de marque)
--terracotta-deep: #A83E14 (hover des CTA)
--bone:       #FCF7F8   (fond principal du site)
--bone-dim:   #F3ECE6   (fond de sections alternées, cartes)
--olive:      #D2D388   (accent secondaire, sparingly — chiffres clés, highlights)
```

La 4ᵉ couleur (olive) a été choisie par défaut parmi deux options validées par le client (voir palette Coolors fournie : olive `#D2D388` vs gris-bleu `#CED3DC`). Garder cette teinte en variable facilement substituable.

### 4.2 Typographie

- **Titres / display** : `Fraunces` (Google Fonts), variable font avec `font-variation-settings: "SOFT" 60, "WONK" 1` pour son caractère « soft/wonky » — ne pas utiliser Fraunces en réglage par défaut, l'axe wonky fait partie de l'identité voulue.
- **Corps / UI** : `Archivo`, poids 400 à 800 selon les besoins.
- Ne pas introduire de troisième famille de police.

### 4.3 Motif signature — « étiquette cousue »

Élément graphique récurrent inspiré des vraies étiquettes papier des produits KEMI SHOES : bordure en pointillés fins, coin arrondi léger, petit cercle « trou de perforation » sur le bord gauche. Utilisé pour : le tag « Fait main à Douala » sur la hero, les badges prix sur les cartes produit, les chips de filtres actifs. Un seul élément de ce type peut être légèrement pivoté (`-3deg`) pour la touche artisanale — ne pas généraliser la rotation, elle doit rester une exception visuelle.

### 4.4 Structure de la page d'accueil (hero)

La hero n'est **pas** un bandeau classique + carrousel. C'est une grille 2×2 asymétrique :
- Haut-gauche : bloc texte (titre + CTA), fond noir, dans la grille elle-même (pas au-dessus).
- Haut-droite : bloc « atelier » — **vidéo en boucle silencieuse sur desktop/tablette** (`autoplay muted loop playsinline`), **photo statique sur mobile** (choix volontaire pour ne pas consommer de data mobile inutilement — cohérent avec la sensibilité du marché camerounais au coût de la data).
- Bas : deux cases catégories (Femme/Homme actuellement), dimensionnées selon leur importance commerciale — actuellement 56/44, valeur à rendre facilement ajustable (config, pas codée en dur dans le JSX).

**Sur mobile**, les cases atelier + catégories du bas sont masquées ; à la place, le bloc texte de la hero a un **carrousel d'images en fond, en fondu automatique en boucle** (CSS-only de préférence, avec fallback statique si `prefers-reduced-motion: reduce`).

### 4.5 Placeholders images

Tant que le nouveau shooting photo n'est pas livré par KEMI SHOES, utiliser des placeholders visuels avec un dégradé sombre texturé (voir maquettes) plutôt que des images génériques de stock — cela évite de donner une fausse impression du rendu final. Prévoir un composant `<ProductImagePlaceholder />` réutilisable.

---

## 5. Plan du site à implémenter

Reprendre l'arborescence validée dans le site map. Pages V1 (prioritaires) :

- `/` — Accueil
- `/boutique` (+ variantes filtrées `/boutique/homme`, `/boutique/femme`, `/boutique/nouveautes`, `/boutique/couple-enfant`)
- `/produits/[slug]` — Fiche produit
- `/panier`
- `/commande` — Checkout en 3–4 étapes (Livraison → Paiement → Récapitulatif → Confirmation)
- `/compte/connexion` — Connexion / Inscription (OAuth + téléphone/OTP + email de secours)
- `/compte/commandes` — Mes commandes (liste + détail avec suivi de statut)
- `/compte/informations` — Profil + adresses enregistrées
- `/notre-histoire`
- `/aide` (+ `/aide/faq`, `/aide/livraison-retours`, `/aide/guide-des-tailles`)
- `/contact`
- Pages légales : `/mentions-legales`, `/cgv`, `/confidentialite`
- `404` personnalisée

Pages V2 (prévoir l'architecture pour ne pas bloquer leur ajout, mais ne pas les développer maintenant) : blog/journal, sur-mesure, liste de souhaits, programme de fidélité, espace presse.

Pour chaque page listée, le détail visuel exact (structure, contenu, micro-interactions) est dans les fichiers HTML haute-fidélité déjà livrés — s'y référer plutôt que de réinterpréter depuis ce document.
pour les pages legales utilises les bibiotheques suivantes : remark remark-html rehype-stringify pour convertir le fichier markdown qui sera fourni en entre en page html
---

## 6. Internationalisation FR/EN

- Routing par préfixe de locale : `/fr/...` et `/en/...`, **`fr` en locale par défaut** (majorité francophone camerounaise), redirection automatique selon `Accept-Language` à la première visite puis persistance du choix (cookie), avec un sélecteur de langue visible dans le header et le footer.
- Tous les textes d'interface (boutons, labels, messages d'erreur, emails transactionnels, SMS/WhatsApp de confirmation) doivent passer par le système de traduction (`next-international`), aucun texte en dur dans les composants.
- Les données produit (nom, description, matière, instructions d'entretien) doivent être stockées avec un champ par langue dans le modèle de données — prévoir dès le schéma une structure du type `{ fr: string, en: string }` plutôt qu'un champ texte unique, même si seul le FR est rempli au lancement.
- Les URLs de produit/catégorie doivent avoir un slug localisé si pertinent (`/fr/boutique/sandales-homme` vs `/en/shop/men-sandals`), avec un système de correspondance de slugs entre langues pour permettre un changement de langue qui reste sur la même page produit/catégorie plutôt que de renvoyer à l'accueil.
- Formatage des devises et dates localisé (FCFA toujours affiché tel quel, mais formats de date/nombre adaptés fr-CM/en selon la locale active).

---

## 7. SEO — à construire dès la base, pas en correction ultérieure

- **Rendu SSR/SSG** pour toutes les pages boutique, catalogue et produit (via Server Components + `generateStaticParams`/ISR pour les fiches produit — revalidation périodique plutôt que full CSR).
- **Métadonnées dynamiques** (`generateMetadata`) par page : title, description, Open Graph, Twitter Card — générées à partir des données produit/catégorie réelles, avec fallback propre si un champ manque.
- **Données structurées JSON-LD** :
  - `Product` (avec `offers`, `aggregateRating` une fois les avis en place) sur chaque fiche produit.
  - `BreadcrumbList` sur toutes les pages profondes.
  - `Organization` + `LocalBusiness` (adresse pk11, Douala) sur la page d'accueil / contact.
- **`sitemap.xml`** généré dynamiquement (route handler `sitemap.ts`), incluant les deux locales avec balises `hreflang` correctes reliant les versions FR/EN d'une même page.
- **`robots.txt`** configuré pour autoriser l'indexation des pages boutique et bloquer les pages compte/panier/checkout.
- Attributs `alt` obligatoires et significatifs sur toutes les images produit (texte descriptif, pas juste le nom de fichier).
- Core Web Vitals : prioriser LCP sur la hero (précharger l'image/poster vidéo principale), éviter le layout shift sur les grilles produit (dimensions réservées via `next/image` avec `width`/`height` ou `fill` + conteneur dimensionné).

---

## 8. Architecture backend & logique métier

### 8.1 Paiement — pattern ports & adapters

Ne jamais appeler un SDK d'agrégateur directement depuis la logique de commande. Définir une interface commune :

```ts
interface PaymentGateway {
  createPayment(order: OrderInput): Promise<PaymentSession>;
  verifyPayment(reference: string): Promise<PaymentStatus>;
}
```

Puis une implémentation par prestataire : `StripeGateway` (cartes internationales), et un ou plusieurs adaptateurs Mobile Money locaux (Monetbil, Campay, CinetPay — le choix définitif reste à confirmer côté produit, l'agent doit livrer au moins un adaptateur fonctionnel + l'interface prête à en recevoir d'autres). Le même principe s'applique à la livraison si un transporteur externe est branché plus tard.

### 8.2 Zones de livraison — pilotées depuis l'admin, pas codées en dur

Modèle de données minimal pour une zone de livraison :

```
DeliveryZone {
  id
  country
  regionOrCity (optionnel — vide = pays entier)
  fee
  estimatedDeliveryMin / estimatedDeliveryMax (en heures ou jours)
  availablePaymentMethods: PaymentMethod[]
  codAvailable: boolean
  active: boolean
}
```

C'est ce paramétrage qui détermine dynamiquement, à l'étape 1 du checkout, les frais/délais affichés, et à l'étape 2, quels moyens de paiement sont proposés. Développement V1 : se concentrer sur le marché camerounais national ; l'architecture doit permettre d'ajouter une zone internationale ou un nouveau pays sans changement de code, juste une nouvelle entrée de configuration.

### 8.3 Paiement à la livraison

Disponible uniquement pour les zones avec `codAvailable: true` — actuellement le Cameroun uniquement. Ne pas l'exposer comme option pour les zones internationales.

### 8.4 Personnalisation produit

- **Couleur et matière personnalisables sur l'ensemble du catalogue** — champ générique au niveau produit, pas une exception par article.
- **Disponibilité des tailles variable par produit** — modèle de données avec une liste de tailles disponibles par produit (pas une plage fixe globale), y compris la possibilité de marquer une taille comme temporairement indisponible sans la supprimer du catalogue.

### 8.5 Comptes utilisateurs — stratégie de rétention

- Panier/checkout accessibles en **invité par défaut**, jamais de compte obligatoire pour acheter.
- Authentification : **OAuth Google et Facebook** en premier, puis **téléphone + code OTP** (SMS avec repli WhatsApp) comme méthode principale pour la clientèle locale, email/mot de passe en option secondaire discrète.
- Sur la page de confirmation de commande, proposer la création de compte en un clic, pré-remplie avec les données déjà saisies au checkout, avec une incitation (ex. -5% sur la prochaine commande).
- Si un numéro de téléphone utilisé en invité correspond à un compte créé ultérieurement, l'historique de commandes doit s'y rattacher automatiquement plutôt que de créer un doublon.

### 8.6 Cookies et consentement

Bannière de consentement à la première visite avec 4 catégories : essentiels (toujours actifs), mesure d'audience, marketing/publicité, personnalisation — granularité complète (Tout accepter / Refuser sauf essentiels / Personnaliser), page dédiée détaillant chaque finalité. Point d'attention : la livraison internationale pouvant amener des clients UE, prévoir la conformité RGPD en plus du cadre camerounais (à faire valider par un juriste avant mise en production, l'agent implémente le mécanisme technique mais ne tranche pas le texte légal).

---

## 9. Dashboard administrateur — périmètre en cours de définition

**Ce périmètre n'est pas encore figé.** La structure standard du dashboard (quelles sections, quelles pages, quelle organisation) est en cours d'établissement séparément, sur la base des pratiques standards des back-offices e-commerce, avant tout travail de design. Ne pas se baser uniquement sur les points ci-dessous pour construire le dashboard final — ils seront remplacés ou complétés par un document de structure dédié (même format que le site map de la boutique) une fois validé.

Pistes exprimées par le client, à intégrer dans la structure standard une fois celle-ci arrêtée, plutôt qu'à développer telles quelles dans l'immédiat :
- Un résumé de statistiques clés en page d'accueil du dashboard (nombre de ventes, nombre de commandes).
- Un classement des produits les plus vendus, avec une présentation différenciée desktop (graphique en barres horizontales) / mobile (cartes avec indicateur de tendance : flèche verte en hausse, flèche rouge en baisse, tiret si stable).
- Un écran de création/édition de fiche produit avec upload de photos, description, gestion des couleurs et de la personnalisation, gestion des tailles disponibles par produit, et un aperçu en temps réel de la fiche telle qu'elle apparaîtra en carte catalogue et en page produit complète.

L'agent doit prévoir une architecture de dashboard extensible (layout avec navigation latérale, système de cartes/widgets réutilisable) sans sur-investir dans le détail de chaque écran tant que la structure complète n'est pas validée.

---

## 10. Références visuelles fournies

Les [fichiers](/references) suivants (situe dans le dossier reference) font foi pour l'implémentation pixel par pixel de chaque page — ce prompt donne le cadre et les règles, les fichiers HTML donnent le détail exact :

- `accueil_hifi.html`
- `catalogue_hifi.html`
- `fiche_produit_hifi.html`
- `panier_hifi.html`
- `checkout_hifi.html`
- `connexion_hifi.html` (connexion / inscription — OAuth Google/Facebook, téléphone + OTP, email de secours)
- `wireframe_compte.html` (mes commandes, mes informations — wireframe basse fidélité, la version haute-fidélité reste à produire en cohérence avec les fichiers ci-dessus)

À utiliser comme référence de structure, d'espacement, de comportement responsive et de micro-interactions — pas seulement comme inspiration visuelle approximative. 

---

## 11. Ce qui n'est pas dans le périmètre de ce prompt

- Choix définitif de l'agrégateur Mobile Money (en cours d'évaluation côté client — l'architecture doit juste être prête à le recevoir).
- Rédaction finale des textes légaux (CGV, politique de confidentialité, mentions légales) — prévoir les pages et leur structure, pas leur contenu juridique définitif.
- Photographie et vidéo réelles du produit/atelier (placeholders en attendant).
- Programme de fidélité, sur-mesure, blog — V2.