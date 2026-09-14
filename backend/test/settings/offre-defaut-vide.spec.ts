/**
 * Schéma Settings : le pied de ticket par défaut est VIDE et ne porte le nom
 * d'aucune enseigne.
 *
 * Régression vécue chez Radiance le 14/09/2026 : leurs Settings n'avaient pas
 * de champ `offreFacture`, Mongoose appliquait le défaut du schéma à la
 * lecture, et chaque reçu sortait avec « Pour vous remercier, Family Store
 * vous offre 5 % de réduction sur votre prochain achat ». Une promesse
 * commerciale faite au nom d'un autre commerce.
 *
 * Le test instancie le modèle sans base : le défaut d'un sous-document est
 * appliqué à la construction, c'est exactement ce qui se passe à l'hydratation
 * d'un document qui n'a pas le champ.
 */
import mongoose from 'mongoose';
import { SettingsSchema } from '../../src/settings/settings.schema';

const Settings = mongoose.model('SettingsOffreDefaut', SettingsSchema);

describe('Settings.offreFacture — défaut', () => {
  it('est entièrement vide', () => {
    const s = new Settings({}).toObject() as any;
    for (const champ of ['titre', 'message', 'validite', 'cta', 'salutation']) {
      expect(s.offreFacture?.[champ] ?? '').toBe('');
    }
  });

  it('ne porte le nom d’aucune autre enseigne dans l’offre', () => {
    // Témoin de la vraie régression : la remise de 5 % au nom de « Family Store ».
    const s = new Settings({}).toObject() as any;
    expect(JSON.stringify(s.offreFacture ?? {})).not.toMatch(/family\s*store/i);
    expect(JSON.stringify(s.offreFacture ?? {})).not.toMatch(/vous offre/i);
  });

  it('une offre SAISIE est conservée telle quelle (témoin)', () => {
    const s = new Settings({ offreFacture: { titre: '', message: 'Enjoy 10% off', validite: '', cta: '', salutation: '' } }).toObject() as any;
    expect(s.offreFacture.message).toBe('Enjoy 10% off');
  });
});
