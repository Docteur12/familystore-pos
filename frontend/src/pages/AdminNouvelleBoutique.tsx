/**
 * Ajouter une boutique — formulaire puis paiement.
 *
 * L'ÉCRAN DIT CE QUI SE PASSE VRAIMENT : la boutique n'est pas créée à la
 * validation du formulaire, mais à la confirmation du paiement. L'afficher
 * autrement — « boutique créée, à régler plus tard » — donnerait un magasin
 * dans lequel on saisirait des produits avant de savoir s'il est payé, et
 * qu'il faudrait ensuite se résoudre à supprimer.
 *
 * L'attente interroge le serveur toutes les quatre secondes. Elle ne se fie
 * pas à une notification du prestataire : en Mobile Money, elles se perdent.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import { useIsMobile } from '../hooks/useIsMobile';
import { demanderBoutique, etatPaiement, reessayerPaiement, telephonePayeurParDefaut, Paiement } from '../api/paiements';
import { normaliserTelephone, formatTelephoneAttendu } from '../utils/telephone';
import { t } from '../i18n';

const SONDAGE_MS = 4000;

export default function AdminNouvelleBoutique() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024);

  const [nom, setNom]                 = useState('');
  const [ville, setVille]             = useState('Douala');
  const [patronNom, setPatronNom]     = useState('');
  const [patronEmail, setPatronEmail] = useState('');
  const [motDePasse, setMotDePasse]   = useState('');
  const [telephone, setTelephone]     = useState('');
  const [erreur, setErreur]           = useState('');
  const [envoi, setEnvoi]             = useState(false);
  const [paiement, setPaiement]       = useState<Paiement | null>(null);

  const minuterie = useRef<number | null>(null);

  // Numéro du propriétaire, en SUGGESTION. Il reste modifiable : le patron
  // peut régler depuis un autre compte Mobile Money, et c'est le numéro
  // réellement débité qui doit partir chez l'opérateur.
  useEffect(() => {
    // `actuel` et non `t` : `t` est la fonction de traduction, la masquer ici
    // rendrait le fichier trompeur à la lecture.
    telephonePayeurParDefaut().then(n => setTelephone(actuel => actuel || n)).catch(() => {});
  }, []);

  // Interrogation de l'état pendant l'attente. Arrêtée dès qu'un état
  // définitif est connu — inutile de continuer à parler au serveur.
  useEffect(() => {
    if (!paiement || paiement.statut !== 'en_attente') return;
    minuterie.current = window.setInterval(async () => {
      try {
        const frais = await etatPaiement(paiement.reference);
        setPaiement(frais);
      } catch { /* réseau : on retentera au tour suivant */ }
    }, SONDAGE_MS);
    return () => { if (minuterie.current) window.clearInterval(minuterie.current); };
  }, [paiement?.reference, paiement?.statut]);

  const soumettre = useCallback(async () => {
    setErreur('');
    if (!nom.trim())          return setErreur(t('Le nom de la boutique est obligatoire.', 'The store name is required.'));
    if (!patronNom.trim())    return setErreur(t('Le nom du responsable est obligatoire.', 'The manager’s name is required.'));
    if (!patronEmail.trim())  return setErreur(t('L’e-mail du responsable est obligatoire.', 'The manager’s email is required.'));
    if (motDePasse.length < 6) return setErreur(t('Le mot de passe doit compter au moins 6 caractères.', 'The password must be at least 6 characters long.'));
    // Contrôle AVANT l'appel : un numéro mal formé n'échouerait pas chez nous
    // mais chez l'opérateur, sous la forme d'un « solde insuffisant »
    // que le commerçant chercherait du mauvais côté.
    const numero = normaliserTelephone(telephone);
    if (!numero) return setErreur(formatTelephoneAttendu());

    setEnvoi(true);
    try {
      const p = await demanderBoutique({
        nom: nom.trim(), ville: ville.trim(),
        patron: { nom: patronNom.trim(), email: patronEmail.trim(), motDePasse },
        telephonePayeur: numero,
      });
      setPaiement(p);
      setMotDePasse('');   // plus besoin de le garder à l'écran
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : t('Erreur', 'Error'));
    } finally {
      setEnvoi(false);
    }
  }, [nom, ville, patronNom, patronEmail, motDePasse, telephone]);

  const champ: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1.5px solid var(--fs-line)',
    borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'var(--fs-font-sans)', background: '#fff', color: 'var(--fs-ink-900)',
  };
  const etiquette: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)',
    textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5,
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--fs-ivory)' }}>

        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 28px' }}>
          <div style={{ paddingLeft: isMobile ? 52 : 0 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>{t('Plateforme', 'Platform')}</p>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>
              {t('Ajouter une boutique', 'Add a store')}
            </h1>
          </div>
        </div>

        <div style={{ padding: isNarrow ? '16px' : '20px 28px 40px', maxWidth: 620 }}>

          {!paiement && (
            <>
              <div style={{ background: 'var(--fs-wine-100)', border: '1px solid var(--fs-wine-700)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
                <p style={{ fontSize: 12.5, color: 'var(--fs-ink-900)', margin: 0, lineHeight: 1.6 }}>
                  {t(
                    'La boutique sera créée une fois le paiement confirmé — pas avant. Rien n’est enregistré tant que le règlement n’est pas passé.',
                    'The store will be created once the payment is confirmed — not before. Nothing is recorded until the payment goes through.',
                  )}
                </p>
              </div>

              {erreur && (
                <div style={{ background: '#FBE9E5', color: '#8C2B16', padding: '10px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, marginBottom: 16 }}>
                  {erreur}
                </div>
              )}

              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={etiquette}>{t('Nom de la boutique', 'Store name')}</label>
                  <input value={nom} onChange={e => setNom(e.target.value)} style={champ} placeholder={t('Ex. Bonamoussadi', 'e.g. Bonamoussadi')}/>
                </div>
                <div>
                  <label style={etiquette}>{t('Ville', 'City')}</label>
                  <input value={ville} onChange={e => setVille(e.target.value)} style={champ}/>
                </div>

                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-wine-700)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '4px 0 0' }}>
                  {t('Responsable de la boutique', 'Store manager')}
                </p>
                <p style={{ fontSize: 11.5, color: 'var(--fs-ink-500)', margin: 0, lineHeight: 1.6 }}>
                  {t(
                    'Ce compte pourra tout gérer dans la nouvelle boutique. Ce peut être vous : dans ce cas, indiquez votre propre adresse.',
                    'This account will manage everything in the new store. It can be you — in that case, use your own address.',
                  )}
                </p>
                <div>
                  <label style={etiquette}>{t('Nom complet', 'Full name')}</label>
                  <input value={patronNom} onChange={e => setPatronNom(e.target.value)} style={champ}/>
                </div>
                <div>
                  <label style={etiquette}>{t('Adresse e-mail', 'Email address')}</label>
                  <input type="email" value={patronEmail} onChange={e => setPatronEmail(e.target.value)} style={champ}/>
                </div>
                <div>
                  <label style={etiquette}>{t('Mot de passe', 'Password')}</label>
                  <input type="password" value={motDePasse} onChange={e => setMotDePasse(e.target.value)} style={champ} placeholder={t('6 caractères minimum', 'At least 6 characters')}/>
                </div>

                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-wine-700)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '4px 0 0' }}>
                  {t('Paiement', 'Payment')}
                </p>
                <div>
                  <label style={etiquette}>{t('Numéro Mobile Money à débiter', 'Mobile Money number to charge')}</label>
                  <input
                    value={telephone}
                    onChange={e => setTelephone(e.target.value)}
                    style={{
                      ...champ,
                      // Rouge dès la saisie si le format ne va pas — mais
                      // seulement une fois que l'utilisateur a commencé.
                      borderColor: telephone && !normaliserTelephone(telephone) ? '#C23E24' : 'var(--fs-line)',
                    }}
                    inputMode="numeric"
                    placeholder="6XXXXXXXX"
                  />
                  <p style={{ fontSize: 11.5, color: 'var(--fs-ink-500)', margin: '6px 0 0', lineHeight: 1.6 }}>
                    {t(
                      'Pré-rempli avec votre numéro, modifiable : vous pouvez régler depuis un autre compte Mobile Money. C’est ce numéro qui sera débité, il doit être celui du payeur.',
                      'Pre-filled with your number, editable: you can pay from another Mobile Money account. This is the number that will be charged — it must be the payer’s.',
                    )}
                  </p>
                </div>

                <button onClick={soumettre} disabled={envoi}
                  style={{ marginTop: 4, padding: '12px', background: 'var(--fs-wine-700)', color: '#fff', border: '2px solid var(--fs-gold-400)', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: envoi ? 'default' : 'pointer', opacity: envoi ? 0.7 : 1 }}>
                  {envoi ? t('Ouverture du paiement…', 'Opening payment…') : t('Continuer vers le paiement', 'Continue to payment')}
                </button>
              </div>
            </>
          )}

          {paiement && (
            <EtatPaiement
              paiement={paiement}
              onTermine={() => navigate('/admin/dashboard')}
              onRecommencer={async () => {
                // Une nouvelle tentative passe par le serveur : le
                // prestataire refuse une référence déjà employée, il en faut
                // une neuve. Le lien avec l'essai précédent est conservé.
                try {
                  setPaiement(await reessayerPaiement(paiement.reference, normaliserTelephone(telephone) ?? ''));
                } catch (e: unknown) {
                  setErreur(e instanceof Error ? e.message : t('Erreur', 'Error'));
                  setPaiement(null);
                }
              }}
            />
          )}

        </div>
      </main>
    </div>
  );
}

// ── Suivi du paiement ────────────────────────────────────────────────────────

function EtatPaiement({ paiement, onTermine, onRecommencer }: {
  paiement: Paiement; onTermine: () => void; onRecommencer: () => void | Promise<void>;
}) {
  const montant = `${paiement.montant.toLocaleString('fr-FR').replace(/ | /g, ' ')} ${paiement.devise}`;

  const cadre = (bord: string, fond: string): React.CSSProperties => ({
    background: fond, border: `1px solid ${bord}`, borderLeft: `4px solid ${bord}`,
    borderRadius: 12, padding: '18px 20px',
  });

  if (paiement.statut === 'confirme') {
    return (
      <div style={cadre('#5A8B53', '#F1F7EF')}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px', color: 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-display)' }}>
          {t('Paiement confirmé — boutique créée', 'Payment confirmed — store created')}
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--fs-ink-700)', lineHeight: 1.65, margin: '0 0 14px' }}>
          {t(
            `« ${paiement.nomBoutique ?? ''} » est en service. Le responsable peut s’y connecter avec l’adresse indiquée. Vous la retrouverez dans le sélecteur de boutique, en haut du menu.`,
            `“${paiement.nomBoutique ?? ''}” is live. The manager can sign in with the address you provided. You will find it in the store selector, at the top of the menu.`,
          )}
        </p>
        <button onClick={onTermine} style={{ padding: '10px 18px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {t('Terminer', 'Done')}
        </button>
      </div>
    );
  }

  if (paiement.statut === 'echoue') {
    return (
      <div style={cadre('#C23E24', '#FBE9E5')}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px', color: 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-display)' }}>
          {t('Paiement refusé', 'Payment declined')}
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--fs-ink-700)', lineHeight: 1.65, margin: '0 0 14px' }}>
          {t(
            'Aucune boutique n’a été créée et rien ne vous a été débité. Vous pouvez recommencer.',
            'No store was created and nothing was charged. You can try again.',
          )}
        </p>
        <button onClick={onRecommencer} style={{ padding: '10px 18px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {t('Recommencer', 'Try again')}
        </button>
      </div>
    );
  }

  // En attente, ou délai dépassé. Dans les deux cas on continue de surveiller :
  // une confirmation tardive reste possible, et elle créera la boutique.
  const tarde = paiement.statut === 'expire' || paiement.depasse;
  return (
    <div style={cadre(tarde ? 'var(--fs-gold-500)' : 'var(--fs-wine-700)', '#fff')}>
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px', color: 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-display)' }}>
        {tarde
          ? t('Paiement toujours pas confirmé', 'Payment still not confirmed')
          : t('En attente du paiement', 'Waiting for payment')}
      </h2>
      <p style={{ fontSize: 12.5, color: 'var(--fs-ink-700)', lineHeight: 1.65, margin: '0 0 12px' }}>
        {tarde
          ? t(
              'Si vous avez bien payé, ne payez pas une seconde fois : nous continuons d’interroger l’opérateur, et la boutique sera créée dès que le règlement nous parviendra, même avec du retard.',
              'If you did pay, do not pay again: we keep checking with the operator, and the store will be created as soon as the payment reaches us, even late.',
            )
          : t(
              `Réglez ${montant} pour créer la boutique. Cette page se met à jour toute seule — inutile de la recharger.`,
              `Pay ${montant} to create the store. This page updates by itself — no need to reload.`,
            )}
      </p>

      {/* La page de paiement s'ouvre dans un ONGLET : cet écran doit rester
          vivant, c'est lui qui interroge et qui conclut. Le prestataire ne
          fournit pas d'adresse de retour fiable. */}
      {paiement.urlPaiement && !tarde && (
        <a href={paiement.urlPaiement} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-block', padding: '11px 20px', background: 'var(--fs-wine-700)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none', marginBottom: 12 }}>
          {t('Ouvrir la page de paiement', 'Open the payment page')} ↗
        </a>
      )}

      {/* Ouverture ratée chez le prestataire : sans issue affichée, le
          commerçant resterait devant une attente qui ne finit jamais. */}
      {!paiement.urlPaiement && !tarde && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12.5, color: '#8C2B16', fontWeight: 600, margin: '0 0 8px', lineHeight: 1.6 }}>
            {t(
              'La page de paiement n’a pas pu être ouverte. Rien ne vous a été débité.',
              'The payment page could not be opened. Nothing has been charged.',
            )}
          </p>
          <button onClick={() => { void onRecommencer(); }}
            style={{ padding: '10px 18px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {t('Réessayer', 'Try again')}
          </button>
        </div>
      )}

      {tarde && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => { void onRecommencer(); }}
            style={{ padding: '10px 18px', background: 'none', border: '1.5px solid var(--fs-wine-700)', color: 'var(--fs-wine-700)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {t('Payer à nouveau', 'Pay again')}
          </button>
          <p style={{ fontSize: 11.5, color: 'var(--fs-ink-500)', margin: '8px 0 0', lineHeight: 1.6 }}>
            {t(
              'Sans risque de double facturation : si le premier règlement finit par nous parvenir, il ne créera pas une seconde boutique.',
              'No risk of being charged twice: if the first payment does reach us, it will not create a second store.',
            )}
          </p>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', fontFamily: 'var(--fs-font-mono)', marginTop: 4 }}>
        {t('Référence', 'Reference')} : {paiement.reference}
        {paiement.tentative > 1 && ` · ${t('tentative', 'attempt')} ${paiement.tentative}`}
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--fs-ink-500)', margin: '10px 0 0', lineHeight: 1.6 }}>
        {t(
          'Conservez cette référence : elle identifie votre règlement en cas de réclamation.',
          'Keep this reference: it identifies your payment in case of a dispute.',
        )}
      </p>
    </div>
  );
}
