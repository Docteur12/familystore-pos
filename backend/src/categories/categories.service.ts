import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from '../schemas/category.schema';

// Taxonomie initiale (utilisée seulement si la collection est vide).
const SEED: Record<string, string[]> = {
  'Décoration': ['Décoration murale', 'Textile décoratif', 'Décoration de table et accessoires', 'Ambiance et senteurs', 'Décoration événementielle', 'Décoration salle de bain'],
  'Maison / Ménage / Cuisine / Linge': ['Produits entretien', 'Hygiène de la maison', 'Linge de maison', 'Rangement et organisation', 'Arts de table', 'Cuisine et préparation'],
  'Cosmétique / Hygiène': ['Hygiène capillaire', 'Hygiène bucco-dentaire', 'Hygiène corporelle', 'Soins du visage', 'Maquillage du teint', 'Maquillage des yeux', 'Maquillage des lèvres', 'Parfumerie', 'Accessoires beauté', 'Compléments et bien-être'],
  'Alimentation / Boissons': ['Épicerie', 'Snacks et apéritifs', 'Boissons', 'Ingrédients de cuisine', 'Compléments alimentaires', 'Alcools et spiritueux'],
  'Textile / Mode': ['Vêtements', 'Sous-vêtements', 'Chaussettes', 'Chaussures', 'Maroquinerie', 'Accessoires de mode', 'Linge de bain'],
  'Bureau / Hobby': ['Papeterie', 'Fournitures scolaires', 'Loisirs créatifs', 'Jeux éducatifs', 'Puzzles et jeux', 'Jouets'],
  'Multimédia / Électronique / Électricité': ['Audio', 'Énergie et alimentation', 'Éclairage intérieur', 'Éclairage décoratif', 'Accessoires photo et vidéo', 'Horlogerie et affichage', 'Appareils électriques', 'Éclairage événementiel et projection', 'Miroirs lumineux', 'Éclairage portable'],
  'Bébé / Enfant': ['Change et hygiène bébé', 'Alimentation bébé', 'Vêtements bébé', 'Soins bébé', 'Accessoires bébé'],
};

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private model: Model<CategoryDocument>,
  ) {}

  // Renvoie l'arbre { catégorie: [sous-catégories] }. Sème la liste initiale si vide.
  async getTree(): Promise<Record<string, string[]>> {
    let rows = await this.model.find().lean();
    if (rows.length === 0) {
      const seedRows = Object.entries(SEED).flatMap(([category, subs]) =>
        subs.length ? subs.map(subCategory => ({ category, subCategory })) : [{ category, subCategory: '' }],
      );
      await this.model.insertMany(seedRows, { ordered: false }).catch(() => {});
      rows = await this.model.find().lean();
    }
    const tree: Record<string, string[]> = {};
    for (const r of rows) {
      tree[r.category] ??= [];
      if (r.subCategory && !tree[r.category].includes(r.subCategory)) tree[r.category].push(r.subCategory);
    }
    return tree;
  }

  // Ajoute une catégorie (et éventuellement une sous-catégorie).
  async add(category: string, subCategory = ''): Promise<{ ok: boolean }> {
    const cat = (category || '').trim();
    const sub = (subCategory || '').trim();
    if (!cat) return { ok: false };
    // S'assure que la catégorie existe (ligne sans sous-cat) puis ajoute la sous-cat.
    await this.model.updateOne({ category: cat, subCategory: '' }, { $setOnInsert: { category: cat, subCategory: '' } }, { upsert: true }).catch(() => {});
    if (sub) {
      await this.model.updateOne({ category: cat, subCategory: sub }, { $setOnInsert: { category: cat, subCategory: sub } }, { upsert: true }).catch(() => {});
    }
    return { ok: true };
  }

  // Remplace toute la taxonomie par les lignes fournies (import CSV).
  async replaceAll(rows: { category: string; subCategory?: string }[]): Promise<{ count: number }> {
    const clean = rows
      .map(r => ({ category: (r.category || '').trim(), subCategory: (r.subCategory || '').trim() }))
      .filter(r => r.category);
    // dédoublonnage
    const seen = new Set<string>();
    const unique = clean.filter(r => { const k = `${r.category}|||${r.subCategory}`; if (seen.has(k)) return false; seen.add(k); return true; });
    if (unique.length === 0) return { count: 0 };
    await this.model.deleteMany({});
    await this.model.insertMany(unique, { ordered: false }).catch(() => {});
    return { count: unique.length };
  }
}
