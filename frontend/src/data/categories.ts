// Taxonomie catégories → sous-catégories (REC#4).
// Listes déroulantes dépendantes : la sous-catégorie dépend de la catégorie.
export const CATEGORY_TREE: Record<string, string[]> = {
  'Décoration': [
    'Décoration murale', 'Textile décoratif', 'Décoration de table et accessoires',
    'Ambiance et senteurs', 'Décoration événementielle', 'Décoration salle de bain',
  ],
  'Maison / Ménage / Cuisine / Linge': [
    'Produits entretien', 'Hygiène de la maison', 'Linge de maison',
    'Rangement et organisation', 'Arts de table', 'Cuisine et préparation',
  ],
  'Cosmétique / Hygiène': [
    'Hygiène capillaire', 'Hygiène bucco-dentaire', 'Hygiène corporelle', 'Soins du visage',
    'Maquillage du teint', 'Maquillage des yeux', 'Maquillage des lèvres', 'Parfumerie',
    'Accessoires beauté', 'Compléments et bien-être',
  ],
  'Alimentation / Boissons': [
    'Épicerie', 'Snacks et apéritifs', 'Boissons', 'Ingrédients de cuisine',
    'Compléments alimentaires', 'Alcools et spiritueux',
  ],
  'Textile / Mode': [
    'Vêtements', 'Sous-vêtements', 'Chaussettes', 'Chaussures',
    'Maroquinerie', 'Accessoires de mode', 'Linge de bain',
  ],
  'Bureau / Hobby': [
    'Papeterie', 'Fournitures scolaires', 'Loisirs créatifs',
    'Jeux éducatifs', 'Puzzles et jeux', 'Jouets',
  ],
  'Multimédia / Électronique / Électricité': [
    'Audio', 'Énergie et alimentation', 'Éclairage intérieur', 'Éclairage décoratif',
    'Accessoires photo et vidéo', 'Horlogerie et affichage', 'Appareils électriques',
    'Éclairage événementiel et projection', 'Miroirs lumineux', 'Éclairage portable',
  ],
  'Bébé / Enfant': [
    'Change et hygiène bébé', 'Alimentation bébé', 'Vêtements bébé',
    'Soins bébé', 'Accessoires bébé',
  ],
};

export const CATEGORY_LIST = Object.keys(CATEGORY_TREE);

export function subCategoriesOf(category: string): string[] {
  return CATEGORY_TREE[category] ?? [];
}

// Déduction intelligente de la catégorie/sous-catégorie depuis le NOM du produit
// (mots-clés FR/DE — catalogue surtout cosmétique). Renvoie null si rien ne matche.
const KEYWORD_RULES: { re: RegExp; category: string; subCategory: string }[] = [
  { re: /(dento|dentifrice|bain de bouche|zahn|\bdent\b)/i,                         category: 'Cosmétique / Hygiène', subCategory: 'Hygiène bucco-dentaire' },
  { re: /(shampo|shampoing|haarspray|\bhaar|cheveux|d[ée]m[êe]lant|anti.?schuppen|conditioner|apr[èe]s.?shampo)/i, category: 'Cosmétique / Hygiène', subCategory: 'Hygiène capillaire' },
  { re: /(parfum|eau de toilette|eau de parfum|fragrance|s[ée]duction|\bedt\b|\bedp\b)/i, category: 'Cosmétique / Hygiène', subCategory: 'Parfumerie' },
  { re: /(s[ée]rum|d[ée]maquillant|soin.{0,8}visage|\bvisage\b|gesicht|masque|\bcr[èe]me.{0,10}(jour|nuit|visage))/i, category: 'Cosmétique / Hygiène', subCategory: 'Soins du visage' },
  { re: /(vitamine|compl[ée]ment|effervescent|movilis|nahrung|\bq10\b)/i,           category: 'Cosmétique / Hygiène', subCategory: 'Compléments et bien-être' },
  { re: /(fond de teint|poudre|\bblush\b|teint)/i,                                  category: 'Cosmétique / Hygiène', subCategory: 'Maquillage du teint' },
  { re: /(mascara|eyeliner|\bfard\b|crayon.{0,6}yeux|\byeux\b)/i,                   category: 'Cosmétique / Hygiène', subCategory: 'Maquillage des yeux' },
  { re: /(rouge à l[èe]vres|\bgloss\b|l[èe]vres|lipstick|baume.{0,6}l[èe]vres)/i,   category: 'Cosmétique / Hygiène', subCategory: 'Maquillage des lèvres' },
  // Large : corporel (savon, gel douche, déo, lotion, lait, crème mains/corps…) en dernier
  { re: /(savon|gel.{0,4}douche|duschgel|\bdouche\b|d[ée]o\b|deo\b|deodorant|d[ée]odorant|roll.?on|anti.?transpirant|antitranspirant|\bspray\b|lotion|\blait\b|body|beurre de karit|vaseline|[ée]pilatoire|cr[èe]me|\bhand\b|disque)/i, category: 'Cosmétique / Hygiène', subCategory: 'Hygiène corporelle' },
];

export function inferCategoryFromName(name: string): { category: string; subCategory: string } | null {
  for (const r of KEYWORD_RULES) if (r.re.test(name)) return { category: r.category, subCategory: r.subCategory };
  return null;
}
