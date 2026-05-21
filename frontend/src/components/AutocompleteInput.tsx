import React, { useRef, useState } from 'react';

interface Props {
  value:       string;
  onChange:    (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  style?:      React.CSSProperties;
  inputStyle?: React.CSSProperties;
}

// Surligne la partie correspondant à la recherche
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <strong style={{ color: 'var(--fs-wine-700)', fontWeight: 800 }}>
        {text.slice(idx, idx + query.length)}
      </strong>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function AutocompleteInput({ value, onChange, suggestions, placeholder, style, inputStyle }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions;

  const handleSelect = (s: string) => {
    onChange(s);
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 12px',
          border: '1.5px solid var(--fs-line-2)', borderRadius: 8,
          fontSize: 13, outline: 'none', boxSizing: 'border-box',
          fontFamily: 'var(--fs-font-sans)', background: '#fff',
          ...inputStyle,
        }}
      />

      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          zIndex: 500, background: '#fff',
          border: '1.5px solid var(--fs-line-2)', borderRadius: 8,
          boxShadow: '0 6px 24px rgba(0,0,0,0.10)',
          maxHeight: 200, overflowY: 'auto',
        }}>
          {filtered.map(s => (
            <div
              key={s}
              onMouseDown={() => handleSelect(s)}
              style={{
                padding: '9px 14px', fontSize: 13, cursor: 'pointer',
                color: 'var(--fs-ink-800)',
                borderBottom: '1px solid var(--fs-line)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--fs-ivory)')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <Highlight text={s} query={value}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
