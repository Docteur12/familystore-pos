/**
 * MyCoolPay — les pièges constatés en production, verrouillés par des tests.
 *
 * Chaque cas correspond à un incident réel daté du document d'intégration de
 * Tontina Market. Ils ont tous coûté de l'argent ou du service une première
 * fois ; l'objet de ce fichier est qu'ils ne recommencent pas ici.
 *
 * Aucun appel réseau : `fetch` est remplacé.
 */
import { MyCoolPayProvider } from '../../src/platform/paiement/mycoolpay.provider';

describe('MyCoolPayProvider', () => {
  let provider: MyCoolPayProvider;
  let appels: { url: string; init?: any }[];

  /** Programme la prochaine réponse de `fetch`. */
  function repondre(corps: unknown, ok = true, status = 200) {
    (global as any).fetch = jest.fn(async (url: string, init?: any) => {
      appels.push({ url: String(url), init });
      return {
        ok, status,
        json: async () => corps,
        text: async () => JSON.stringify(corps),
      };
    });
  }

  beforeEach(() => {
    appels = [];
    provider = new MyCoolPayProvider();
    process.env.COOLPAY_PUBLIC_KEY = 'CLE-PUBLIQUE-TEST';
    process.env.COOLPAY_PRIVATE_KEY = 'CLE-PRIVEE-TEST';
  });

  afterEach(() => {
    delete process.env.COOLPAY_PUBLIC_KEY;
    delete process.env.COOLPAY_PRIVATE_KEY;
    jest.restoreAllMocks();
  });

  // ── Statuts : les chaînes exactes ──────────────────────────────────────

  describe('statuts — chaînes littérales, comparées à l’identique', () => {
    it('SUCCESS ET SUCCESSFUL valent réussite', () => {
      // Piège du 29/07/2026 : la doc annonce SUCCESSFUL, le webhook envoie
      // SUCCESS. N'accepter qu'une orthographe traitait tout paiement réussi
      // comme un échec — argent prélevé, service jamais rendu.
      expect(MyCoolPayProvider.versStatut('SUCCESS')).toBe('confirme');
      expect(MyCoolPayProvider.versStatut('SUCCESSFUL')).toBe('confirme');
    });

    it('FAILED et FAILURE valent échec', () => {
      expect(MyCoolPayProvider.versStatut('FAILED')).toBe('echoue');
      expect(MyCoolPayProvider.versStatut('FAILURE')).toBe('echoue');
    });

    it('TOUT le reste laisse en attente — jamais un échec inventé', () => {
      for (const v of ['PENDING', 'pending', 'success', 'Success', 'SUCCES', 'EXPIRED', '', 'null']) {
        expect(MyCoolPayProvider.versStatut(v)).toBe('en_attente');
      }
      expect(MyCoolPayProvider.versStatut(undefined)).toBe('en_attente');
      expect(MyCoolPayProvider.versStatut(42)).toBe('en_attente');
    });

    it('la comparaison est sensible à la casse — « success » minuscule est l’enveloppe, pas le paiement', () => {
      // `status: "success"` signifie « la requête API a abouti ». Le confondre
      // avec le statut du paiement créditerait des paiements non aboutis.
      expect(MyCoolPayProvider.versStatut('success')).toBe('en_attente');
    });
  });

  // ── Numéro de téléphone ────────────────────────────────────────────────

  describe('numéro du payeur', () => {
    it('retire l’indicatif et les séparateurs', () => {
      expect(MyCoolPayProvider.normaliserTelephone('+237 690 00 00 00')).toBe('690000000');
      expect(MyCoolPayProvider.normaliserTelephone('237690000000')).toBe('690000000');
      expect(MyCoolPayProvider.normaliserTelephone('6-90-00-00-00')).toBe('690000000');
    });

    it('refuse ce qui n’est pas un mobile camerounais à 9 chiffres', () => {
      // Un mauvais numéro produit chez MyCoolPay un « solde insuffisant »
      // incompréhensible pour le commerçant.
      expect(MyCoolPayProvider.normaliserTelephone('69000000')).toBeNull();     // 8 chiffres
      expect(MyCoolPayProvider.normaliserTelephone('7900000000')).toBeNull();   // ne commence pas par 6
      expect(MyCoolPayProvider.normaliserTelephone('')).toBeNull();
      expect(MyCoolPayProvider.normaliserTelephone(undefined)).toBeNull();
    });
  });

  // ── Création ───────────────────────────────────────────────────────────

  describe('création du paiement', () => {
    const demande = {
      reference: 'CAM-ABC123',
      montant: 120_000,
      devise: 'XAF',
      description: 'Licence annuelle',
      client: { nom: 'Valdes', email: 'proprio@cameleon.cm', telephone: '+237 690 00 00 00' },
    };

    it('appelle paylink avec la clé publique dans l’URL et sans en-tête d’authentification', async () => {
      repondre({ status: 'success', payment_url: 'https://my-coolpay.com/p/xyz', transaction_ref: 'TR-9' });

      const cree = await provider.creer(demande);

      expect(appels[0].url).toBe('https://my-coolpay.com/api/CLE-PUBLIQUE-TEST/paylink');
      const entetes = appels[0].init.headers ?? {};
      expect(Object.keys(entetes).map(k => k.toLowerCase())).not.toContain('authorization');

      const corps = JSON.parse(appels[0].init.body);
      expect(corps.app_transaction_ref).toBe('CAM-ABC123');
      expect(corps.customer_phone_number).toBe('690000000');   // 9 chiffres, sans 237
      expect(corps.transaction_amount).toBe(120_000);          // entier XAF
      expect(corps.transaction_currency).toBe('XAF');

      expect(cree).toEqual({ referenceFournisseur: 'TR-9', urlPaiement: 'https://my-coolpay.com/p/xyz' });
    });

    it('refuse de partir sans numéro exploitable, avec un message actionnable', async () => {
      await expect(provider.creer({ ...demande, client: { ...demande.client, telephone: 'x' } }))
        .rejects.toThrow(/9 chiffres commençant par 6/);
    });

    it('ne remonte JAMAIS la réponse brute du prestataire', async () => {
      // Piège n° 10 : le corps d'erreur contient la réponse MyCoolPay, sans
      // intérêt pour un commerçant et indiscrète sur l'intégration.
      repondre({ status: 'error', message: 'Duplicate transaction reference' }, false, 409);

      await expect(provider.creer(demande)).rejects.toThrow(/MyCoolPay a refusé la demande \(409\)/);
      await expect(provider.creer(demande)).rejects.not.toThrow(/Duplicate/);
    });

    it('refuse une enveloppe qui n’est pas « success »', async () => {
      repondre({ status: 'error', message: 'clé invalide' });
      await expect(provider.creer(demande)).rejects.toThrow(/refusée par MyCoolPay/);
    });
  });

  // ── checkStatus : la seule autorité ────────────────────────────────────

  describe('interrogation — la seule autorité', () => {
    it('interroge checkStatus par la référence MyCoolPay', async () => {
      repondre({ status: 'success', transaction_status: 'SUCCESS', app_transaction_ref: 'CAM-1', transaction_ref: 'TR-1' });

      const etat = await provider.interroger('CAM-1', 'TR-1');

      expect(appels[0].url).toBe('https://my-coolpay.com/api/CLE-PUBLIQUE-TEST/checkStatus/TR-1');
      expect(etat.statut).toBe('confirme');
    });

    it('sans référence MyCoolPay, ne conclut rien et n’appelle rien', async () => {
      repondre({ status: 'success', transaction_status: 'SUCCESS' });
      const etat = await provider.interroger('CAM-1', null);
      expect(etat.statut).toBe('en_attente');
      expect(appels).toHaveLength(0);
    });

    it('REJETTE une transaction rattachée à une AUTRE référence applicative', async () => {
      // Sans ce contrôle, une transaction réelle appartenant à quelqu'un
      // d'autre pourrait être rejouée pour faire confirmer notre paiement.
      repondre({ status: 'success', transaction_status: 'SUCCESS', app_transaction_ref: 'CAM-AUTRE', transaction_ref: 'TR-1' });

      const etat = await provider.interroger('CAM-1', 'TR-1');

      expect(etat.statut).toBe('en_attente');   // surtout pas « confirme »
    });

    it('une enveloppe non « success » ne conclut rien', async () => {
      repondre({ status: 'error', message: 'transaction inconnue' });
      expect((await provider.interroger('CAM-1', 'TR-1')).statut).toBe('en_attente');
    });

    it('réseau en panne : en attente, jamais un échec', async () => {
      (global as any).fetch = jest.fn(async () => { throw new Error('ECONNRESET'); });
      expect((await provider.interroger('CAM-1', 'TR-1')).statut).toBe('en_attente');
    });

    it('un statut inconnu de l’API laisse en attente', async () => {
      repondre({ status: 'success', transaction_status: 'WHATEVER', app_transaction_ref: 'CAM-1' });
      expect((await provider.interroger('CAM-1', 'TR-1')).statut).toBe('en_attente');
    });
  });

  // ── Webhook ────────────────────────────────────────────────────────────

  describe('webhook — on n’en retire que des références', () => {
    const corpsReel = {
      transaction_ref: 'TR-7',
      app_transaction_ref: 'CAM-7',
      transaction_status: 'SUCCESS',
      transaction_type: 'PAYIN',
      transaction_amount: 120000,
      transaction_currency: 'XAF',
      transaction_operator: 'CM_MOMO',
      signature: 'peu importe',
    };
    const brut = (o: unknown) => Buffer.from(JSON.stringify(o), 'utf8');

    it('extrait les DEUX références, et rien du statut annoncé', () => {
      const signal = provider.extraireReference({}, brut(corpsReel));
      expect(signal).toMatchObject({ reference: 'CAM-7', referenceFournisseur: 'TR-7' });
      // Le statut annoncé n'est pas remonté : rien dans le signal ne permet
      // de conclure sans passer par checkStatus.
      expect(Object.keys(signal!)).not.toContain('statut');
    });

    it('accepte une SIGNATURE FAUSSE sans rien bloquer', () => {
      // Le 28/07/2026, 794 200 combinaisons testées sans correspondance :
      // bloquer sur la signature aurait rejeté 100 % des paiements légitimes.
      const signal = provider.extraireReference({}, brut({ ...corpsReel, signature: 'totalement-fausse' }));
      expect(signal?.reference).toBe('CAM-7');
    });

    it('accepte un webhook SANS signature', () => {
      const { signature, ...sansSignature } = corpsReel;
      expect(provider.extraireReference({}, brut(sansSignature))?.reference).toBe('CAM-7');
    });

    it('se contente de la référence MyCoolPay si la nôtre manque', () => {
      const { app_transaction_ref, ...sansRefApp } = corpsReel;
      const signal = provider.extraireReference({}, brut(sansRefApp));
      expect(signal?.reference).toBeUndefined();
      expect(signal?.referenceFournisseur).toBe('TR-7');
    });

    it('rend null si aucune référence n’est lisible — l’appelant répondra 500', () => {
      expect(provider.extraireReference({}, brut({ transaction_status: 'SUCCESS' }))).toBeNull();
      expect(provider.extraireReference({}, Buffer.from('pas du JSON', 'utf8'))).toBeNull();
    });
  });
});
