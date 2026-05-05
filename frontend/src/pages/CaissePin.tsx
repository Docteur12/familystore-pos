import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTokenPayload } from '../api/dashboard';

const PIN_LENGTH  = 4;
const APP_VERSION = '2.4.1';

// ── SVG helpers ───────────────────────────────────────────────────────────────

function CrownMark() {
  return (
    <svg width="52" height="52" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" fill="rgba(255,255,255,0.10)"/>
      <circle cx="24" cy="24" r="22" fill="none" stroke="var(--fs-gold-400)" strokeWidth="1"/>
      <path d="M14 22 L18 14 L22 20 L24 12 L26 20 L30 14 L34 22 L34 27 L14 27 Z"
            fill="var(--fs-gold-400)" stroke="var(--fs-gold-300)" strokeWidth="0.5"/>
      <circle cx="18" cy="14" r="1.1" fill="var(--fs-gold-300)"/>
      <circle cx="24" cy="12" r="1.1" fill="var(--fs-gold-300)"/>
      <circle cx="30" cy="14" r="1.1" fill="var(--fs-gold-300)"/>
      <text x="24" y="37" textAnchor="middle" fontFamily="Cormorant Garamond, serif"
            fontSize="8" fontWeight="600" fill="var(--fs-gold-300)" letterSpacing="0.1em">FS</text>
    </svg>
  );
}

function BackspaceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
      <line x1="18" y1="9" x2="12" y2="15"/>
      <line x1="12" y1="9" x2="18" y2="15"/>
    </svg>
  );
}

// ── Numpad button ─────────────────────────────────────────────────────────────

function PadBtn({ label, onClick }: { label: React.ReactNode; onClick: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => { setPressed(false); onClick(); }}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => { setPressed(false); onClick(); }}
      style={{
        width: 58,
        height: 58,
        borderRadius: '50%',
        border: '1.5px solid var(--fs-line-2)',
        background: pressed ? 'var(--fs-line)' : 'var(--fs-paper)',
        fontSize: 20,
        fontWeight: 500,
        color: 'var(--fs-ink-900)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: pressed ? 'none' : 'var(--fs-shadow-sm)',
        transition: 'background 0.08s, box-shadow 0.08s',
        fontFamily: 'var(--fs-font-sans)',
      }}
    >
      {label}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CaissePin() {
  const navigate = useNavigate();
  const payload  = getTokenPayload();

  // Caisse assignée au caissier — incluse dans le JWT lors du login
  const caisse = payload?.caisse;

  const [pin,   setPin]   = useState('');
  const [error, setError] = useState(false);
  const [time,  setTime]  = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const initials = (payload?.name ?? '?')
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const verify = useCallback((entered: string) => {
    if (!caisse?.pin) {
      // Aucune caisse assignée — accès direct (cas patron/gestionnaire)
      navigate('/caisse');
      return;
    }
    if (entered === caisse.pin) {
      navigate('/caisse');
    } else {
      setError(true);
      setTimeout(() => { setPin(''); setError(false); }, 700);
    }
  }, [navigate, caisse]);

  const handleDigit = useCallback((d: string) => {
    setPin(prev => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + d;
      if (next.length === PIN_LENGTH) {
        // defer so the last dot fills before navigation
        setTimeout(() => verify(next), 80);
      }
      return next;
    });
    setError(false);
  }, [verify]);

  const handleBack = useCallback(() => {
    setPin(p => p.slice(0, -1));
    setError(false);
  }, []);

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      else if (e.key === 'Backspace')    handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleDigit, handleBack]);

  const dateLabel = time.toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });
  const timeLabel = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateStr   = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'var(--fs-font-sans)' }}>

      {/* ── Left panel ── */}
      <div style={{
        width: '38%',
        background: 'var(--fs-wine-800)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 40px',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ marginBottom: 20 }}>
            <CrownMark />
          </div>

          <h1 style={{
            fontFamily: 'var(--fs-font-display)',
            fontSize: 38,
            fontWeight: 600,
            color: '#fff',
            letterSpacing: '0.02em',
            margin: '0 0 6px',
            lineHeight: 1.1,
          }}>Family Store</h1>

          <p style={{
            fontFamily: 'var(--fs-font-display)',
            fontSize: 13,
            fontStyle: 'italic',
            color: 'var(--fs-gold-300)',
            letterSpacing: '0.06em',
            margin: 0,
          }}>by RDCT — Beauté · Saveurs · Bien-être</p>

          <div style={{
            height: 1,
            background: 'linear-gradient(90deg, var(--fs-gold-500), transparent)',
            margin: '28px 0',
            opacity: 0.4,
          }}/>

          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, margin: '0 0 5px' }}>
            Espace de caisse · {caisse?.ville ?? 'Douala'}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
            {dateStr} — {timeLabel}
          </p>
        </div>

        <p style={{
          color: 'var(--fs-gold-500)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          margin: 0,
        }}>
          Version {APP_VERSION} · {caisse?.nom ?? 'CAISSE'}
        </p>
      </div>

      {/* ── Right panel ── */}
      <div style={{
        flex: 1,
        background: 'var(--fs-ivory)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 26,
      }}>

        {/* Avatar */}
        <div style={{
          width: 76,
          height: 76,
          borderRadius: '50%',
          background: 'var(--fs-wine-700)',
          border: '3px solid var(--fs-gold-400)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 24,
          fontWeight: 700,
          fontFamily: 'var(--fs-font-display)',
          letterSpacing: '0.04em',
          flexShrink: 0,
        }}>{initials}</div>

        {/* Name */}
        <div style={{ textAlign: 'center', lineHeight: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--fs-ink-900)', marginBottom: 6 }}>
            {payload?.name ?? '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', letterSpacing: '0.02em' }}>
            Caissière · {caisse?.nom ?? '—'}
          </div>
        </div>

        {/* PIN dots */}
        <div style={{ textAlign: 'center' }}>
          <p style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--fs-ink-400)',
            margin: '0 0 16px',
          }}>Entrez votre code PIN</p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div key={i} style={{
                width: 13,
                height: 13,
                borderRadius: '50%',
                background: error
                  ? 'var(--fs-danger-500)'
                  : i < pin.length ? 'var(--fs-wine-700)' : 'transparent',
                border: `2px solid ${
                  error
                    ? 'var(--fs-danger-500)'
                    : i < pin.length ? 'var(--fs-wine-700)' : 'var(--fs-ink-300)'
                }`,
                transition: 'background 0.12s, border-color 0.12s',
              }}/>
            ))}
          </div>
        </div>

        {/* Numpad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 58px)', gap: 10 }}>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <PadBtn key={n} label={n} onClick={() => handleDigit(String(n))}/>
          ))}
          {/* Row 4 */}
          <div/>
          <PadBtn label="0" onClick={() => handleDigit('0')}/>
          <button
            onClick={handleBack}
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              color: 'var(--fs-ink-400)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BackspaceIcon/>
          </button>
        </div>

        {/* Change user */}
        <button
          onClick={() => { localStorage.removeItem('access_token'); navigate('/login'); }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--fs-wine-700)',
            fontSize: 13,
            cursor: 'pointer',
            textDecoration: 'underline',
            fontFamily: 'var(--fs-font-sans)',
            marginTop: 4,
          }}
        >Changer d'utilisateur</button>

      </div>

      <style>{`@keyframes shake {
        0%,100%{transform:translateX(0)}
        20%,60%{transform:translateX(-6px)}
        40%,80%{transform:translateX(6px)}
      }`}</style>
    </div>
  );
}
