import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgotPassword } from '../api/auth';
import { useIsMobile } from '../hooks/useIsMobile';

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

  // Affiche un message si on a été redirigé suite à une session expirée (401).
  useEffect(() => {
    if (sessionStorage.getItem('session_expired')) {
      setExpiredNotice(true);
      sessionStorage.removeItem('session_expired');
    }
  }, []);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true); setForgotMsg(null); setError(null);
    try {
      const res = await forgotPassword(forgotEmail);
      setForgotMsg(res.message);
    } catch (err: any) {
      setError(err.message ?? 'Erreur inconnue');
    } finally {
      setForgotLoading(false);
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
      if (res.status === 401) throw new Error('Email ou mot de passe incorrect');
      if (!res.ok)           throw new Error('Erreur serveur, réessayez');
      const data = await res.json();
      localStorage.setItem('access_token', data.access_token);
      const pl = JSON.parse(atob(data.access_token.split('.')[1]));
      if (pl.role === 'patron')            navigate('/admin/dashboard');
      else if (pl.role === 'gestionnaire') navigate('/stocks/dashboard');
      else if (pl.role === 'magazinier')   navigate('/magazinier');
      else if (pl.role === 'commercial')   navigate('/partenaires');
      else                                 navigate('/caisse-pin');
    } catch (err: any) {
      setError(err.message ?? 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--fs-ivory)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'var(--fs-font-sans)',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* ── Logo block ── */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {/* Crown SVG */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <svg width={isMobile ? 48 : 64} height={isMobile ? 48 : 64} viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" fill="var(--fs-wine-700)"/>
              <circle cx="24" cy="24" r="22" fill="none" stroke="var(--fs-gold-400)" strokeWidth="1.2"/>
              <path d="M14 22 L18 14 L22 20 L24 12 L26 20 L30 14 L34 22 L34 27 L14 27 Z"
                    fill="var(--fs-gold-400)" stroke="var(--fs-gold-300)" strokeWidth="0.5"/>
              <circle cx="18" cy="14" r="1.1" fill="var(--fs-gold-300)"/>
              <circle cx="24" cy="12" r="1.1" fill="var(--fs-gold-300)"/>
              <circle cx="30" cy="14" r="1.1" fill="var(--fs-gold-300)"/>
              <text x="24" y="37" textAnchor="middle" fontFamily="Cormorant Garamond, serif"
                    fontSize="8" fontWeight="600" fill="var(--fs-gold-300)" letterSpacing="0.1em">FS</text>
            </svg>
          </div>

          <h1 style={{
            fontFamily: 'var(--fs-font-display)',
            fontSize: isMobile ? 26 : 32,
            fontWeight: 600,
            color: 'var(--fs-wine-700)',
            letterSpacing: '0.02em',
            margin: 0,
          }}>
            Family Store
          </h1>
          <p style={{
            fontFamily: 'var(--fs-font-display)',
            fontSize: 14,
            fontStyle: 'italic',
            color: 'var(--fs-gold-600)',
            letterSpacing: '0.08em',
            marginTop: 4,
          }}>
            by RDCT — Point de Vente
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
            background: 'linear-gradient(90deg, transparent, var(--fs-gold-400) 30%, var(--fs-gold-400) 70%, transparent)',
            borderRadius: 1,
            marginBottom: 24,
            opacity: 0.7,
          }}/>

          {forgotMode ? (
            <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fs-ink-700)', margin: '0 0 6px' }}>Mot de passe oublié</p>
                <p style={{ fontSize: 12, color: 'var(--fs-ink-400)', margin: 0 }}>Entrez votre email pour recevoir un mot de passe temporaire.</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fs-ink-500)', marginBottom: 6 }}>Adresse email</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-400)', display: 'flex', alignItems: 'center' }}>
                    <MailIcon/>
                  </span>
                  <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="email@familystore.cm" required autoFocus
                    style={{ width: '100%', paddingLeft: 40, paddingRight: 14, paddingTop: 11, paddingBottom: 11, border: '1px solid var(--fs-line-2)', borderRadius: 'var(--fs-r-md)', outline: 'none', fontSize: 14, background: 'var(--fs-ivory)', color: 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-sans)', boxSizing: 'border-box' }}/>
                </div>
              </div>
              {error && (
                <div style={{ background: 'var(--fs-danger-100)', border: '1px solid rgba(194,62,36,0.2)', color: 'var(--fs-danger-700)', borderRadius: 'var(--fs-r-md)', padding: '10px 14px', fontSize: 13 }}>{error}</div>
              )}
              {forgotMsg && (
                <div style={{ background: '#e8f0e5', border: '1px solid rgba(90,139,83,0.3)', color: 'var(--fs-success-700)', borderRadius: 'var(--fs-r-md)', padding: '10px 14px', fontSize: 13 }}>{forgotMsg}</div>
              )}
              <button type="submit" disabled={forgotLoading} style={{ width: '100%', padding: '13px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 'var(--fs-r-md)', fontSize: 14, fontWeight: 600, cursor: forgotLoading ? 'not-allowed' : 'pointer', opacity: forgotLoading ? 0.8 : 1 }}>
                {forgotLoading ? 'Envoi en cours…' : 'Envoyer le mot de passe temporaire'}
              </button>
              <button type="button" onClick={() => { setForgotMode(false); setError(null); setForgotMsg(null); }} style={{ background: 'none', border: 'none', color: 'var(--fs-ink-400)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                Retour à la connexion
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

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
                Session expirée — veuillez vous reconnecter.
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
                Adresse email
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
                  placeholder="email@familystore.cm"
                  required
                  autoFocus
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
                    e.target.style.borderColor = 'var(--fs-wine-700)';
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
                Mot de passe
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
                    e.target.style.borderColor = 'var(--fs-wine-700)';
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
                  title={showPwd ? 'Masquer' : 'Afficher'}
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
                  Verr. Maj (Caps Lock) est activé
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
                background: loading ? 'var(--fs-wine-600)' : 'var(--fs-wine-700)',
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
              onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = 'var(--fs-wine-800)'; }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = loading ? 'var(--fs-wine-600)' : 'var(--fs-wine-700)'; }}
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
                  Connexion…
                </>
              ) : 'Se connecter'}
            </button>

            <button type="button" onClick={() => { setForgotMode(true); setError(null); }} style={{ background: 'none', border: 'none', color: 'var(--fs-ink-400)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', textAlign: 'center' }}>
              Mot de passe oublié ?
            </button>

          </form>
          )}
        </div>

        {/* ── Footer ── */}
        <p style={{
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--fs-ink-400)',
          marginTop: 20,
        }}>
          Family Store POS &copy; {new Date().getFullYear()} — by RDCT
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
