import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SettingsDocument = HydratedDocument<Settings>;

/**
 * Types d'établissement de la gamme Caméléon.
 *
 * Miroir de frontend/src/api/settings.ts (TYPES_ETABLISSEMENT) — verrouillé
 * par types-etablissement-governance.spec.ts. Un profil = un jeu de modules
 * préréglés (settings/profils.ts), un écran d'accueil pour le caissier, un
 * vocabulaire. Jamais un fork.
 */
export const TYPES_ETABLISSEMENT = ['commerce', 'snack', 'restaurant', 'hotel'] as const;
export type TypeEtablissement = (typeof TYPES_ETABLISSEMENT)[number];

@Schema({ timestamps: true })
export class Settings {
  /**
   * Nom commercial du magasin — OBLIGATOIRE à la création d'une boutique.
   *
   * Le défaut était « Family Store ». Une boutique neuve héritait donc du nom
   * d'un autre commerçant, imprimé sur ses tickets. Le défaut est désormais
   * VIDE : si le nom manque malgré tout, un ticket sans en-tête vaut mieux
   * qu'un ticket portant l'enseigne de quelqu'un d'autre.
   *
   * Le caractère obligatoire n'est PAS porté par `required` ici : ce serait
   * `SettingsService.get()`, qui crée le document singleton quand il manque,
   * qui échouerait — et une boutique se retrouverait incapable d'ouvrir sa
   * propre page de paramètres. Il est donc imposé aux deux endroits où le nom
   * se décide : le provisionnement (`ProvisionnementService.creerBoutique`)
   * et l'enregistrement des paramètres (`SettingsService.update`).
   */
  @Prop({ default: '', trim: true })
  nomMagasin: string;

  @Prop({ default: '' })
  adresse: string;

  @Prop({ default: 'Douala' })
  ville: string;

  @Prop({ default: '' })
  telephone: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: 'XAF' })
  devise: string;

  @Prop({ default: '' })
  logoUrl: string;   // base64 ou URL

  /**
   * Manuel d'utilisation de CETTE boutique — adresse d'un PDF.
   *
   * Le menu pointait en dur sur `/manuel-family-store.pdf`. Radiance affichait
   * donc à ses employés le manuel d'un autre commerce, en français, avec des
   * copies d'écran qui ne sont pas les siennes. Chaque client aura le sien.
   *
   * Vide = l'entrée de menu n'apparaît pas. Mieux vaut pas de manuel qu'un
   * mauvais manuel : un employé qui suit des instructions étrangères fait des
   * gestes faux en croyant bien faire.
   */
  @Prop({ default: '' })
  manuelUrl: string;

  @Prop({ type: { ouverture: String, fermeture: String }, default: { ouverture: '08:00', fermeture: '20:00' } })
  horaires: { ouverture: string; fermeture: string };

  @Prop({ type: { facebook: String, whatsapp: String }, default: { facebook: '', whatsapp: '' } })
  reseauxSociaux: { facebook: string; whatsapp: string };

  @Prop({ default: 'fr', enum: ['fr', 'en'] })
  langue: string;

  /**
   * Couleur de la boutique (interface + PDF). Défaut : le vert Caméléon.
   *
   * Le défaut était `#FF0000`. `applyPrimaryColor` en dérive TOUTE la palette
   * `--fs-wine-*` par éclaircissement et assombrissement : `--fs-wine-900`
   * tombait à ≈ `#9E0000`. Une boutique neuve sortait donc en rouge bordeaux,
   * c'est-à-dire aux couleurs de Family Store, sans que personne l'ait choisi.
   *
   * Cette valeur avait échappé au recensement de la marque parce que c'est un
   * code hexadécimal, pas la chaîne « Family Store » — un rappel que l'identité
   * d'un client ne tient pas qu'à son nom.
   */
  @Prop({ default: '#3F8F6B' })
  couleurPrincipale: string;

  @Prop({ default: '#B8893E' })
  couleurSecondaire: string;   // palette « gold » (accents, titres de la caisse)

  // ── Identité imprimée (tickets, PDF, e-mails) ────────────────────────────
  // Historiquement codée en dur « Family Store / BY RDCT / Beauté • Saveur •
  // Bien-être ». Chaque tenant porte désormais la sienne.
  @Prop({ default: '' })
  slogan: string;              // ex. « Beauté • Saveur • Bien-être »

  @Prop({ default: '' })
  signatureTicket: string;     // ex. « BY RDCT » — vide pour ne rien imprimer

  @Prop({ default: '' })
  mentionsLegales: string;     // ex. « NIU : … • RC : … »

  @Prop({ type: [String], default: [] })
  telephonesTicket: string[];  // numéros imprimés sur le ticket (2-3 max)

  // ── Profil métier (gamme Caméléon) ───────────────────────────────────────
  // SOURCE DE VÉRITÉ du type d'établissement : ici, par tenant — et non sur la
  // Boutique du registre, que les clients en mode single n'ont pas. Défaut
  // « commerce » : les documents antérieurs (Family Store, Radiance, HERVAN)
  // ne changent pas de comportement. Modifiable par le superadmin seulement
  // (PATCH /platform/boutiques/:id/type, journalisé) ; PATCH /settings le refuse.
  // Voir CAMELEON-GAMME.md §2.2 et settings/profils.ts pour les préréglages.
  @Prop({ default: 'commerce', enum: TYPES_ETABLISSEMENT })
  typeEtablissement: TypeEtablissement;

  // ── Modules optionnels ───────────────────────────────────────────────────
  // Modules activés pour ce magasin (voir MODULES_DISPONIBLES). Un module
  // absent n'apparaît ni dans les menus ni dans les routes du frontend.
  // Vide = tous actifs (rétro-compatibilité des documents existants).
  @Prop({ type: [String], default: [] })
  modules: string[];

  // ── Règles métier paramétrables ──────────────────────────────────────────
  // suiviPeremption : false pour un magasin dont les produits ne périment pas
  // (vêtements, HERVAN) — plus de date par défaut à la création, alertes et
  // colonne « péremption » masquées. Absent = true (magasins existants).
  @Prop({
    type: { inactiviteMinutes: Number, seedFournisseursDemo: Boolean, suiviPeremption: Boolean },
    default: { inactiviteMinutes: 10, seedFournisseursDemo: true, suiviPeremption: true },
  })
  metier: { inactiviteMinutes: number; seedFournisseursDemo: boolean; suiviPeremption?: boolean };

  // Offre marketing imprimée en pied de facture — éditable (import/export CSV).
  // Les segments entre *astérisques* sont rendus en gras sur le ticket.
  @Prop({
    type: { titre: String, message: String, validite: String, cta: String, salutation: String },
    // VIDE PAR DÉFAUT, et non un texte d'exemple. Ce défaut s'applique à
    // toute boutique NEUVE : il portait le nom « Family Store » et une remise
    // de 5 %, qu'un nouveau client aurait imprimés sur ses reçus sans jamais
    // les avoir décidés — une promesse commerciale faite en son nom. Un pied
    // de ticket vide ne gêne personne ; une offre inventée engage.
    default: {
      titre:      '',
      message:    '',
      validite:   '',
      cta:        '',
      salutation: '',
    },
  })
  offreFacture: { titre: string; message: string; validite: string; cta: string; salutation: string };
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);

/**
 * Modules pouvant être désactivés par magasin (frontend : menus + routes).
 *
 * Miroir de frontend/src/api/settings.ts (MODULES_DISPONIBLES) — meme liste
 * d'identifiants, verrouillé par modules-governance.spec.ts.
 *
 * `comptoir`, `salle`, `reception` sont les modules des profils Snack-bar,
 * Restaurant et Hôtel de la gamme Caméléon. Ils sont déclarés ICI, par le
 * socle, pour que les branches verticales n'aient pas à toucher ce miroir
 * (CAMELEON-GAMME.md §2.2). Tant qu'aucun écran ne les référence, un module
 * déclaré n'affiche rien.
 */
export const MODULES_DISPONIBLES = ['partenaires', 'factures-fournisseurs', 'comptoir', 'salle', 'reception'] as const;
export type ModuleId = (typeof MODULES_DISPONIBLES)[number];
