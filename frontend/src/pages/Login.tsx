import { lireSession, supprimerSession, boutiqueDuJeton } from '../services/storage';
import { basculerVersBoutique, nomDeBoutique } from '../services/session';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgotPassword } from '../api/auth';
import { useIsMobile } from '../hooks/useIsMobile';
import { useSettings } from '../contexts/SettingsContext';
import { t } from '../i18n';

/**
 * Couleurs de l'écran de connexion — FIXES, jamais des variables de thème.
 *
 * `SettingsContext` applique `couleurPrincipale` sur la racine du document
 * dès qu'une boutique est connue. Utiliser `var(--fs-wine-700)` ici ferait
 * donc virer l'écran d'accueil aux couleurs de la dernière boutique visitée —
 * exactement l'identité qu'on veut tenir hors de cet écran.
 */
const ENCRE = '#2E3238';
const ENCRE_PALE = '#8A9099';
const VERT_CAMELEON = '#3F8F6B';
const VERT_SOMBRE = '#2F6B50';   // survol
const VERT_CLAIR = '#5AA585';    // état occupé

/** Marque Caméléon — neutre, sans fichier image à héberger ni à charger. */
function MarqueCameleon({ size = 52 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 3.2,
      background: VERT_CAMELEON,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 10px rgba(63,143,107,0.28)',
    }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none"
        stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        {/* Silhouette stylisée : corps, queue enroulée, patte. */}
        <path d="M3 14c0-3.3 2.7-6 6-6h2.5a4 4 0 0 0 4-4"/>
        <path d="M3 14c0 2.2 1.8 4 4 4h6c2.8 0 5-2.2 5-5"/>
        <path d="M18 13c1.7 0 3 1.3 3 3s-1.3 3-3 3-2-1-2-2 .7-1.5 1.5-1.5"/>
        <path d="M8 18v2.5"/>
        <circle cx="14.6" cy="4.4" r="0.9" fill="#fff" stroke="none"/>
      </svg>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2"/>
      <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="M3 7l9 6 9-6"/>
    </svg>
  );
}

export default function Login() {
  const { settings, reloadSettings } = useSettings();
  const navigate  = useNavigate();
  const isMobile  = useIsMobile();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const [capsOn,   setCapsOn]   = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [expiredNotice, setExpiredNotice] = useState(false);
  /**
   * Reconnexion CIBLÉE : `/login?boutique=<id>` — on arrive du bandeau qui
   * signale des ventes bloquées. Se reconnecter sur une autre boutique ne les
   * débloquerait pas, donc on le dit avant, et on le vérifie après.
   */
  const boutiqueVisee = new URLSearchParams(window.location.search).get('boutique');

  /**
   * Mise au point du champ e-mail SANS faire défiler la page.
   *
   * L'attribut `autoFocus` demandait au navigateur d'amener le champ à
   * l'écran : sur une fenêtre un peu basse, la page s'ouvrait donc DÉFILÉE et
   * le haut — la marque comprise — était coupé. `preventScroll` donne le
   * focus sans bouger la vue.
   */
  const champEmail = React.useRef<HTMLInputElement>(null);
  // Multi-magasin : renseigné quand le serveur demande de choisir la boutique.
  const [choixBoutique, setChoixBoutique] = useState<{
    selectionToken: string;
    boutiques: { tenantId: string; nom: string }[];
  } | null>(null);

  // Affiche un message si on a été redirigé suite à une session expirée (401).
  useEffect(() => {
    if (lireSession('session_expired')) {
      setExpiredNotice(true);
      supprimerSession('session_expired');
    }
  }, []);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Focus du champ e-mail, sans défilement — voir `champEmail` plus haut.
  useEffect(() => {
    if (choixBoutique || forgotMode) return;
    champEmail.current?.focus({ preventScroll: true });
  }, [choixBoutique, forgotMode]);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true); setForgotMsg(null); setError(null);
    try {
      const res = await forgotPassword(forgotEmail);
      setForgotMsg(res.message);
    } catch (err: any) {
      setError(err.message ?? t('Erreur inconnue', 'Unknown error'));
    } finally {
      setForgotLoading(false);
    }
  };

  /** Session ouverte : jeton stocké, paramètres rechargés, aiguillage par rôle. */
  const entrer = async (accessToken: string) => {
    // Reconnexion ciblée : si le compte utilisé ouvre une AUTRE boutique, les
    // ventes en attente resteront bloquées. Mieux vaut le dire tout de suite
    // que de laisser l'utilisateur croire le problème réglé.
    if (boutiqueVisee && boutiqueDuJeton(accessToken) !== boutiqueVisee) {
      setError(t(
        `Ce compte ouvre une autre boutique que ${nomDeBoutique(boutiqueVisee)}. Les ventes en attente y resteront bloquées.`,
        `This account opens a different store than ${nomDeBoutique(boutiqueVisee)}. The pending sales there will stay blocked.`,
      ));
    }
    // Le jeton est rangé sous SA boutique (tenantId), celle-ci devient active,
    // et la langue de la boutique est posée au passage — sans quoi l'arrivée
    // sur une boutique d'une autre langue enchaînerait deux rechargements.
    await basculerVersBoutique(accessToken);
    reloadSettings(); // paramètres complets du magasin (le login n'avait que l'identité publique)
    const pl = JSON.parse(atob(accessToken.split('.')[1]));
    if (pl.role === 'patron')            navigate('/admin/dashboard');
    else if (pl.role === 'gestionnaire') navigate('/stocks/dashboard');
    else if (pl.role === 'magazinier')   navigate('/magazinier');
    else if (pl.role === 'commercial')   navigate('/partenaires');
    else                                 navigate('/caisse-pin');
  };

  /** Second temps du multi-magasin : la boutique désignée délivre le jeton. */
  const choisirBoutique = async (tenantId: string) => {
    if (!choixBoutique) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login/boutique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectionToken: choixBoutique.selectionToken, tenantId }),
      });
      if (!res.ok) throw new Error(t('Session de connexion expirée, recommencez.', 'Sign-in session expired, please start again.'));
      const data = await res.json();
      await entrer(data.access_token);
    } catch (err: any) {
      setChoixBoutique(null);
      setError(err.message ?? t('Erreur inconnue', 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (res.status === 401) throw new Error(t('Email ou mot de passe incorrect', 'Incorrect email or password'));
      if (!res.ok)           throw new Error(t('Erreur serveur, réessayez', 'Server error, please try again'));
      const data = await res.json();
      // Multi-magasin : le mot de passe est bon mais le même e-mail existe dans
      // plusieurs boutiques — on demande laquelle. La liste ne contient que
      // celles où ce couple e-mail/mot de passe est valide (voir AuthService).
      if (data.choixBoutique) {
        setChoixBoutique({ selectionToken: data.selectionToken, boutiques: data.boutiques ?? [] });
        return;
      }
      await entrer(data.access_token);
    } catch (err: any) {
      setError(err.message ?? t('Erreur inconnue', 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    /* DÉFILEMENT : `#root` et `body` sont en `overflow: hidden` (index.css) —
       voulu pour une caisse, où chaque écran gère son propre défilement. Cette
       page doit donc gérer le sien, sinon tout ce qui dépasse est perdu.

       Et l'on centre par `margin: auto` sur l'enfant, PAS par
       `align-items: center` : avec un contenu plus haut que l'écran, le
       centrage par alignement fait déborder des deux côtés et rend le haut
       comme le bas inatteignables au défilement. Constaté sur l'écran
       « quelle boutique ? » d'un propriétaire à trois boutiques, dont le
       lien « Retour à la connexion » restait hors d'atteinte. */
    <div style={{
      height: '100vh',
      overflowY: 'auto',
      background: 'var(--fs-ivory)',
      display: 'flex',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'var(--fs-font-sans)',
      boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 380, margin: 'auto' }}>

        {/* ── Identité CAMÉLÉON — neutre, jamais celle d'un client ──────────
            Cet écran PRÉCÈDE le choix de la boutique : on ne sait pas encore
            chez qui l'on entre. Y afficher un logo, un nom ou des couleurs de
            magasin serait faux pour tous les autres, et absurde pour un
            propriétaire multi-boutiques qui verrait l'enseigne de l'une avant
            de choisir l'autre.

            Les couleurs sont donc écrites EN DUR, pas via les variables de
            thème : `couleurPrincipale` est appliquée à la racine du document
            dès que les paramètres d'une boutique arrivent (SettingsContext),
            et teinterait cet écran-ci. L'identité du magasin — logo, couleurs,
            langue — ne se charge qu'APRÈS la sélection. */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 20 : 26 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <MarqueCameleon size={isMobile ? 44 : 52}/>
          </div>

          <h1 style={{
            fontFamily: 'var(--fs-font-display)',
            fontSize: isMobile ? 26 : 30,
            fontWeight: 600,
            color: ENCRE,
            letterSpacing: '0.06em',
            margin: 0,
          }}>
            Caméléon
          </h1>
          <p style={{
            fontSize: 12,
            color: ENCRE_PALE,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            margin: '6px 0 0',
          }}>
            {t('Point de vente', 'Point of sale')}
          </p>
        </div>

        {/* ── Card ── */}
        <div style={{
          background: 'var(--fs-paper)',
          border: '1px solid var(--fs-line)',
          borderRadius: 'var(--fs-r-lg)',
          boxShadow: 'var(--fs-shadow-md)',
          padding: isMobile ? '20px 16px 18px' : '28px 28px 24px',
        }}>
          {/* Gold hairline */}
          <div style={{
            height: 2,
            background: `linear-gradient(90deg, transparent, ${VERT_CAMELEON} 30%, ${VERT_CAMELEON} 70%, transparent)`,
            borderRadius: 1,
            marginBottom: 24,
            opacity: 0.7,
          }}/>

          {choixBoutique ? (
            /* Multi-magasin : le mot de passe est déjà validé, il reste à
               désigner la boutique. Seules celles où ce couple est valide
               figurent ici — le serveur refuse toute autre. */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fs-ink-700)', margin: '0 0 6px' }}>
                  {t('Quelle boutique ?', 'Which store?')}
                </p>
                <p style={{ fontSize: 12, color: 'var(--fs-ink-400)', margin: 0 }}>
                  {t('Ce compte donne accès à plusieurs boutiques.', 'This account gives access to several stores.')}
                </p>
              </div>

              {choixBoutique.boutiques.map(b => (
                <button
                  key={b.tenantId}
                  type="button"
                  disabled={loading}
                  onClick={() => choisirBoutique(b.tenantId)}
                  style={{
                    padding: '14px 16px', borderRadius: 10, cursor: loading ? 'default' : 'pointer',
                    border: '1.5px solid var(--fs-line-2)', background: '#fff',
                    fontSize: 15, fontWeight: 600, color: 'var(--fs-ink-900)',
                    textAlign: 'left', fontFamily: 'var(--fs-font-sans)',
                  }}
                >
                  {b.nom}
                </button>
              ))}

              <button
                type="button"
                onClick={() => { setChoixBoutique(null); setPassword(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', marginTop: 4,
                  fontSize: 12, color: 'var(--fs-ink-400)', textDecoration: 'underline',
                }}
              >
                {t('Retour à la connexion', 'Back to sign in')}
              </button>
            </div>
          ) : forgotMode ? (
            <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fs-ink-700)', margin: '0 0 6px' }}>{t('Mot de passe oublié', 'Forgot password')}</p>
                <p style={{ fontSize: 12, color: 'var(--fs-ink-400)', margin: 0 }}>{t('Entrez votre email pour recevoir un mot de passe temporaire.', 'Enter your email to receive a temporary password.')}</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fs-ink-500)', marginBottom: 6 }}>{t('Adresse email', 'Email address')}</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-400)', display: 'flex', alignItems: 'center' }}>
                    <MailIcon/>
                  </span>
                  <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder={t('adresse@exemple.cm', 'address@example.cm')} required autoFocus
                    style={{ width: '100%', paddingLeft: 40, paddingRight: 14, paddingTop: 11, paddingBottom: 11, border: '1px solid var(--fs-line-2)', borderRadius: 'var(--fs-r-md)', outline: 'none', fontSize: 14, background: 'var(--fs-ivory)', color: 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-sans)', boxSizing: 'border-box' }}/>
                </div>
              </div>
              {error && (
                <div style={{ background: 'var(--fs-danger-100)', border: '1px solid rgba(194,62,36,0.2)', color: 'var(--fs-danger-700)', borderRadius: 'var(--fs-r-md)', padding: '10px 14px', fontSize: 13 }}>{error}</div>
              )}
              {forgotMsg && (
                <div style={{ background: '#e8f0e5', border: '1px solid rgba(90,139,83,0.3)', color: 'var(--fs-success-700)', borderRadius: 'var(--fs-r-md)', padding: '10px 14px', fontSize: 13 }}>{forgotMsg}</div>
              )}
              <button type="submit" disabled={forgotLoading} style={{ width: '100%', padding: '13px', background: VERT_CAMELEON, color: '#fff', border: 'none', borderRadius: 'var(--fs-r-md)', fontSize: 14, fontWeight: 600, cursor: forgotLoading ? 'not-allowed' : 'pointer', opacity: forgotLoading ? 0.8 : 1 }}>
                {forgotLoading ? t('Envoi en cours…', 'Sending…') : t('Envoyer le mot de passe temporaire', 'Send temporary password')}
              </button>
              <button type="button" onClick={() => { setForgotMode(false); setError(null); setForgotMsg(null); }} style={{ background: 'none', border: 'none', color: 'var(--fs-ink-400)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                {t('Retour à la connexion', 'Back to sign in')}
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {boutiqueVisee && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 4,
                background: '#FEF3C7', border: '1px solid #F59E0B', color: '#7C2D12', fontSize: 12.5,
              }}>
                {t('Reconnexion à', 'Signing back in to')} <strong>{nomDeBoutique(boutiqueVisee)}</strong>{' '}
                {t('pour envoyer les ventes en attente.', 'to send the pending sales.')}
              </div>
            )}

            {expiredNotice && (
              <div style={{
                background: '#FEF7E6', border: '1px solid #F0D080',
                color: '#8B5A14', borderRadius: 'var(--fs-r-md)',
                padding: '10px 14px', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                </svg>
                {t('Session expirée — veuillez vous reconnecter.', 'Session expired — please sign in again.')}
              </div>
            )}

            {/* Email */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--fs-ink-500)',
                marginBottom: 6,
              }}>
                {t('Adresse email', 'Email address')}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--fs-ink-400)', display: 'flex', alignItems: 'center',
                }}>
                  <MailIcon/>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('adresse@exemple.cm', 'address@example.cm')}
                  required
                  ref={champEmail}
                  style={{
                    width: '100%',
                    paddingLeft: 40,
                    paddingRight: 14,
                    paddingTop: 11,
                    paddingBottom: 11,
                    border: `1px solid var(--fs-line-2)`,
                    borderRadius: 'var(--fs-r-md)',
                    outline: 'none',
                    fontSize: 14,
                    background: 'var(--fs-ivory)',
                    color: 'var(--fs-ink-900)',
                    fontFamily: 'var(--fs-font-sans)',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = VERT_CAMELEON;
                    e.target.style.boxShadow = '0 0 0 3px rgba(122,29,46,0.08)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'var(--fs-line-2)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--fs-ink-500)',
                marginBottom: 6,
              }}>
                {t('Mot de passe', 'Password')}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--fs-ink-400)', display: 'flex', alignItems: 'center',
                }}>
                  <LockIcon/>
                </span>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyUp={e => setCapsOn(e.getModifierState('CapsLock'))}
                  onKeyDown={e => setCapsOn(e.getModifierState('CapsLock'))}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    paddingLeft: 40,
                    paddingRight: 42,
                    paddingTop: 11,
                    paddingBottom: 11,
                    border: `1px solid var(--fs-line-2)`,
                    borderRadius: 'var(--fs-r-md)',
                    outline: 'none',
                    fontSize: 14,
                    background: 'var(--fs-ivory)',
                    color: 'var(--fs-ink-900)',
                    fontFamily: 'var(--fs-font-sans)',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = VERT_CAMELEON;
                    e.target.style.boxShadow = '0 0 0 3px rgba(122,29,46,0.08)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'var(--fs-line-2)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--fs-ink-400)', display: 'flex', alignItems: 'center', padding: 2,
                  }}
                  title={showPwd ? t('Masquer', 'Hide') : t('Afficher', 'Show')}
                >
                  {showPwd ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/>
                      <path d="M10.73 10.73A2 2 0 0 0 12 14a2 2 0 0 0 1.27-3.27"/>
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {capsOn && (
                <div style={{
                  marginTop: 6, display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, fontWeight: 600, color: 'var(--fs-danger-700)',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/>
                  </svg>
                  {t('Verr. Maj (Caps Lock) est activé', 'Caps Lock is on')}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'var(--fs-danger-100)',
                border: '1px solid rgba(194,62,36,0.2)',
                color: 'var(--fs-danger-700)',
                borderRadius: 'var(--fs-r-md)',
                padding: '10px 14px',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 3L2 20h20L12 3z"/><path d="M12 10v5M12 18v.5"/>
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: loading ? VERT_CLAIR : VERT_CAMELEON,
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--fs-r-md)',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'var(--fs-font-sans)',
                letterSpacing: '0.04em',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.8 : 1,
                transition: 'background 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: 'var(--fs-shadow-sm)',
                marginTop: 4,
              }}
              onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = VERT_SOMBRE; }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = loading ? VERT_CLAIR : VERT_CAMELEON; }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 16, height: 16,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.7s linear infinite',
                  }}/>
                  {t('Connexion…', 'Signing in…')}
                </>
              ) : t('Se connecter', 'Sign in')}
            </button>

            <button type="button" onClick={() => { setForgotMode(true); setError(null); }} style={{ background: 'none', border: 'none', color: 'var(--fs-ink-400)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', textAlign: 'center' }}>
              {t('Mot de passe oublié ?', 'Forgot password?')}
            </button>

          </form>
          )}
        </div>

        {/* ── Pied — neutre lui aussi : voir l'en-tête ── */}
        <p style={{
          textAlign: 'center',
          fontSize: 11,
          color: ENCRE_PALE,
          marginTop: 16,
        }}>
          Caméléon &copy; {new Date().getFullYear()}
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
