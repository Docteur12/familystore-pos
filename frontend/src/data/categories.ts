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
  'Hygiène / Beauté': [
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
