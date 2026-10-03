// Catalogue de démarrage construit à partir des photos de backend/images_demo.
// Clé = nom de fichier sans extension ni suffixe de vue (_1, _2…) : toutes les
// vues d'un même modèle deviennent les images d'un seul produit.

const FEMME_SIZES = ['36', '37', '38', '39', '40', '41'];
const HOMME_SIZES = ['39', '40', '41', '42', '43', '44'];
const MIXTE_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43'];

const C = {
  noir: { name: 'Noir', hex: '#14120F' },
  cognac: { name: 'Cognac', hex: '#92502F' },
  camel: { name: 'Camel', hex: '#D2A477' },
  terracotta: { name: 'Terracotta', hex: '#D2531E' },
  blanc: { name: 'Blanc', hex: '#F4F1EA' },
  jaune: { name: 'Jaune', hex: '#E3B23C' },
  bleu: { name: 'Bleu', hex: '#2F4E7A' },
  denim: { name: 'Denim', hex: '#4A6A8C' },
  orange: { name: 'Orange', hex: '#E0712C' },
  dore: { name: 'Doré', hex: '#C9A54B' },
};

export const PRODUCTS = {
  'mule_à_bague_d_orteil_bicolore': {
    nameFr: 'Mule bicolore à bague d’orteil', nameEn: 'Two-tone toe ring mule',
    descriptionFr: 'Mule en cuir bicolore avec bague d’orteil, légère et facile à porter au quotidien.',
    descriptionEn: 'Two-tone leather mule with a toe ring, light and easy to wear every day.',
    category: 'Femme', price: 22000, colors: [C.cognac, C.blanc], sizes: FEMME_SIZES,
  },
  'mule_à_bague_d_orteil_et_boucle_h_métallique': {
    nameFr: 'Mule à bague d’orteil et boucle H métallique', nameEn: 'Toe ring mule with metal H buckle',
    descriptionFr: 'Bague d’orteil et boucle métallique en H : une mule graphique, finie à la main à Douala.',
    descriptionEn: 'Toe ring and metal H buckle: a graphic mule, hand-finished in Douala.',
    category: 'Femme', price: 25000, colors: [C.noir, C.dore], sizes: FEMME_SIZES,
  },
  'mule_à_bague_d_orteil_et_bride_asymétrique': {
    nameFr: 'Mule à bague d’orteil et bride asymétrique', nameEn: 'Toe ring mule with asymmetric strap',
    descriptionFr: 'Bride asymétrique et bague d’orteil pour une silhouette moderne et un bon maintien.',
    descriptionEn: 'Asymmetric strap and toe ring for a modern silhouette and a secure fit.',
    category: 'Femme', price: 24000, colors: [C.cognac, C.noir], sizes: FEMME_SIZES,
  },
  'mule_à_bague_d_orteil_et_bride_asymétrique_modele_2': {
    nameFr: 'Mule à bride asymétrique — modèle 2', nameEn: 'Asymmetric strap mule — model 2',
    descriptionFr: 'Variante de notre mule à bride asymétrique, avec une découpe revisitée.',
    descriptionEn: 'A variation of our asymmetric strap mule with a reworked cut.',
    category: 'Nouveautes', price: 24000, colors: [C.camel, C.noir], sizes: FEMME_SIZES,
  },
  'mule_à_bride_diagonale_et_boucle': {
    nameFr: 'Mule à bride diagonale et boucle', nameEn: 'Diagonal strap mule with buckle',
    descriptionFr: 'Une silhouette graphique à bride diagonale réglable, pensée pour durer.',
    descriptionEn: 'A graphic silhouette with an adjustable diagonal strap, made to last.',
    category: 'Femme', price: 32000, colors: [C.noir, C.cognac], sizes: FEMME_SIZES,
  },
  'mule_à_brides_croisées_bimatière_blanc_et_cuir_tressé': {
    nameFr: 'Mule à brides croisées bimatière blanc et cuir tressé', nameEn: 'Crossed strap mule in white and woven leather',
    descriptionFr: 'Brides croisées associant cuir blanc lisse et cuir tressé, pour un contraste lumineux.',
    descriptionEn: 'Crossed straps pairing smooth white leather with woven leather for a bright contrast.',
    category: 'Femme', price: 30000, colors: [C.blanc, C.camel], sizes: FEMME_SIZES,
  },
  'mule_à_brides_croisées_et_semelle_anatomique': {
    nameFr: 'Mule à brides croisées et semelle anatomique', nameEn: 'Crossed strap mule with anatomical footbed',
    descriptionFr: 'Semelle anatomique qui épouse le pied et brides croisées en cuir pour un confort durable.',
    descriptionEn: 'Anatomical footbed that follows the foot and crossed leather straps for lasting comfort.',
    category: 'Femme', price: 28000, colors: [C.cognac, C.noir], sizes: FEMME_SIZES,
  },
  'mule_à_brides_croisées_motif_serpent_et_orange': {
    nameFr: 'Mule à brides croisées motif serpent et orange', nameEn: 'Snake print and orange crossed strap mule',
    descriptionFr: 'Brides croisées mêlant cuir imprimé serpent et cuir orange : la pièce forte de la saison.',
    descriptionEn: 'Crossed straps mixing snake-print and orange leather: the statement piece of the season.',
    category: 'Nouveautes', price: 30000, colors: [C.orange, C.camel], sizes: FEMME_SIZES,
  },
  'mule_à_double_boucle_découpée': {
    nameFr: 'Mule à double boucle découpée', nameEn: 'Cut-out double buckle mule',
    descriptionFr: 'Du caractère et du confort au quotidien, avec deux boucles et une découpe nette.',
    descriptionEn: 'Character and comfort for every day, with two buckles and a clean cut-out.',
    category: 'Homme', price: 30000, colors: [C.cognac, C.camel, C.noir], sizes: HOMME_SIZES,
  },
  'mule_à_double_bride_ajustable_et_boucles': {
    nameFr: 'Mule à double bride ajustable et boucles', nameEn: 'Adjustable double strap mule with buckles',
    descriptionFr: 'Deux brides ajustables à boucles pour un chaussant sur mesure.',
    descriptionEn: 'Two adjustable buckled straps for a made-to-measure fit.',
    category: 'Homme', price: 32000, colors: [C.noir, C.cognac], sizes: HOMME_SIZES,
  },
  'mule_à_large_bande_avec_liseré_bleu_et_écusson_métallique': {
    nameFr: 'Mule à large bande, liseré bleu et écusson métallique', nameEn: 'Wide band mule with blue piping and metal badge',
    descriptionFr: 'Large bande en cuir soulignée d’un liseré bleu et ornée d’un écusson métallique.',
    descriptionEn: 'Wide leather band highlighted with blue piping and a metal badge.',
    category: 'Homme', price: 27000, colors: [C.bleu, C.blanc], sizes: HOMME_SIZES,
  },
  'mule_double_bande_bimatière_à_boucle_métallique': {
    nameFr: 'Mule double bande bimatière à boucle métallique', nameEn: 'Two-material double band mule with metal buckle',
    descriptionFr: 'Deux bandes en matières contrastées réunies par une boucle métallique.',
    descriptionEn: 'Two bands in contrasting materials joined by a metal buckle.',
    category: 'Homme', price: 29000, colors: [C.noir, C.camel], sizes: HOMME_SIZES,
  },
  'mule_en_denim_à_large_bande_et_boucle_métallique_dorée': {
    nameFr: 'Mule en denim à large bande et boucle dorée', nameEn: 'Denim wide band mule with gold buckle',
    descriptionFr: 'Large bande en denim et boucle métallique dorée : une mule décontractée et élégante.',
    descriptionEn: 'Wide denim band and gold metal buckle: a relaxed yet elegant mule.',
    category: 'Nouveautes', price: 26000, colors: [C.denim, C.dore], sizes: MIXTE_SIZES,
  },
  'Mule_entredoigt': {
    nameFr: 'Mule entre-doigt', nameEn: 'Toe post mule',
    descriptionFr: 'Notre mule entre-doigt essentielle, en cuir souple et semelle cousue main.',
    descriptionEn: 'Our essential toe post mule in soft leather with a hand-stitched sole.',
    category: 'Femme', price: 20000, colors: [C.cognac, C.noir, C.terracotta], sizes: FEMME_SIZES,
  },
  'Mule_entredoigt_à_boucle': {
    nameFr: 'Mule entre-doigt à boucle', nameEn: 'Toe post mule with buckle',
    descriptionFr: 'La mule entre-doigt rehaussée d’une boucle pour un maintien ajustable.',
    descriptionEn: 'The toe post mule finished with a buckle for an adjustable fit.',
    category: 'Femme', price: 22000, colors: [C.noir, C.cognac], sizes: FEMME_SIZES,
  },
  'mule_entredoigt_à_motif_carreaux_et_semelle_épaisses': {
    nameFr: 'Mule entre-doigt à carreaux et semelle épaisse', nameEn: 'Checked toe post mule with thick sole',
    descriptionFr: 'Motif à carreaux et semelle épaisse : confort et allure affirmée.',
    descriptionEn: 'Checked pattern and thick sole: comfort with a bold look.',
    category: 'Nouveautes', price: 27000, colors: [C.noir, C.blanc], sizes: FEMME_SIZES,
  },
  'mule_entredoigt_couvrante_en_cuir_tressé': {
    nameFr: 'Mule entre-doigt couvrante en cuir tressé', nameEn: 'Woven leather covered toe post mule',
    descriptionFr: 'Cuir pleine fleur tressé, semelle en cuir cousue main.',
    descriptionEn: 'Woven full-grain leather, hand-stitched leather sole.',
    category: 'Femme', price: 28000, colors: [C.noir, C.cognac, C.terracotta], sizes: FEMME_SIZES,
  },
  'mule_fermée_à_motif_damier_et_mors_métallique': {
    nameFr: 'Mule fermée à damier et mors métallique', nameEn: 'Closed checkerboard mule with metal bit',
    descriptionFr: 'Mule fermée au motif damier, ornée d’un mors métallique.',
    descriptionEn: 'Closed mule with a checkerboard pattern and a metal bit detail.',
    category: 'Homme', price: 35000, colors: [C.noir, C.camel], sizes: HOMME_SIZES,
  },
  'mule_jaune_à_bague_d_orteil_et_large_bande': {
    nameFr: 'Mule jaune à bague d’orteil et large bande', nameEn: 'Yellow toe ring mule with wide band',
    descriptionFr: 'Une touche de couleur : cuir jaune, large bande et bague d’orteil.',
    descriptionEn: 'A pop of colour: yellow leather, wide band and toe ring.',
    category: 'Nouveautes', price: 23000, colors: [C.jaune], sizes: FEMME_SIZES,
  },
  'mule_plateforme_à_nœud_et_fines_brides': {
    nameFr: 'Mule plateforme à nœud et fines brides', nameEn: 'Platform mule with bow and thin straps',
    descriptionFr: 'Semelle plateforme, fines brides et nœud décoratif pour une allure féminine.',
    descriptionEn: 'Platform sole, thin straps and a decorative bow for a feminine look.',
    category: 'Femme', price: 31000, colors: [C.noir, C.camel], sizes: FEMME_SIZES,
  },
  'mules_à_brides_croisées': {
    nameFr: 'Mules à brides croisées', nameEn: 'Crossed strap mules',
    descriptionFr: 'Une ligne essentielle et confortable, déclinée pour toute la famille.',
    descriptionEn: 'An essential, comfortable line made for the whole family.',
    category: 'Couple-Enfant', price: 29000, colors: [C.noir, C.cognac], sizes: MIXTE_SIZES,
  },
  'sandale_pêcheur_à_structure_cage_et_bride_arrière': {
    nameFr: 'Sandale pêcheur à structure cage et bride arrière', nameEn: 'Caged fisherman sandal with back strap',
    descriptionFr: 'Structure cage en cuir et bride arrière : la sandale pêcheur réinterprétée.',
    descriptionEn: 'Caged leather upper and back strap: the fisherman sandal reinterpreted.',
    category: 'Couple-Enfant', price: 33000, colors: [C.cognac, C.noir], sizes: MIXTE_SIZES,
  },
  'sandale_slingback_à_découpe_H': {
    nameFr: 'Sandale slingback à découpe H', nameEn: 'H cut-out slingback sandal',
    descriptionFr: 'Découpe en H sur l’empeigne et bride arrière pour un maintien parfait.',
    descriptionEn: 'H-shaped cut-out on the vamp and a back strap for a perfect hold.',
    category: 'Femme', price: 30000, colors: [C.camel, C.noir], sizes: FEMME_SIZES,
  },
  'sandale_spartiate_en_cuir_à_rivets_et_bride_cheville': {
    nameFr: 'Sandale spartiate à rivets et bride cheville', nameEn: 'Studded gladiator sandal with ankle strap',
    descriptionFr: 'Une spartiate structurée en cuir, rivets métalliques et bride à la cheville.',
    descriptionEn: 'A structured leather gladiator sandal with metal studs and an ankle strap.',
    category: 'Homme', price: 35000, colors: [C.cognac, C.camel], sizes: HOMME_SIZES,
  },
  'sandales_à_bague_d_orteil': {
    nameFr: 'Sandales à bague d’orteil', nameEn: 'Toe ring sandals',
    descriptionFr: 'Élégantes et légères, en cuir souple avec bague d’orteil.',
    descriptionEn: 'Elegant and light, in soft leather with a toe ring.',
    category: 'Nouveautes', price: 26000, colors: [C.cognac, C.terracotta], sizes: FEMME_SIZES,
  },
};

// Photos de marque (pas des produits) : stockées dans MediaAsset et utilisées
// par l'accueil et la page « Notre histoire ».
export const BRAND_MEDIA = {
  atelier: { key: 'atelier', altFr: 'L’atelier KEMI SHOES à Douala', altEn: 'The KEMI SHOES workshop in Douala' },
  atelier_1: { key: 'atelier-2', altFr: 'Travail du cuir dans l’atelier KEMI SHOES', altEn: 'Leather work in the KEMI SHOES workshop' },
  atelier_3: { key: 'atelier-hero', altFr: 'Travail artisanal du cuir dans l’atelier KEMI SHOES', altEn: 'Handcrafted leather work in the KEMI SHOES workshop' },
  fondatrice_kemi_shoes: { key: 'founder', altFr: 'Marthe Nyobe, fondatrice de KEMI SHOES', altEn: 'Marthe Nyobe, founder of KEMI SHOES' },
};
