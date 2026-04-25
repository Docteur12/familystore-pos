import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onDetected, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let stopped = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, err, controls) => {
        controlsRef.current = controls;
        if (!ready) setReady(true);
        if (result && !stopped) {
          stopped = true;
          controls.stop();
          onDetected(result.getText());
          onClose();
        }
      })
      .catch(e => {
        const msg = e?.message ?? '';
        if (msg.includes('Permission'))        setError('Accès caméra refusé — autorisez l\'accès dans le navigateur.');
        else if (msg.includes('device found')) setError('Aucune caméra détectée sur cet appareil.');
        else                                   setError('Impossible d\'ouvrir la caméra : ' + msg);
      });

    return () => {
      stopped = true;
      controlsRef.current?.stop();
    };
  }, []); // eslint-disable-line

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm
        flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl">

        {/* Header */}
        <div className="bg-bordeaux px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-cream font-bold text-sm">Scanner un code QR / code-barres</p>
            <p className="text-gold text-xs mt-0.5">Pointez la caméra vers le code</p>
          </div>
          <button
            onClick={onClose}
            className="text-cream/60 hover:text-cream text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Camera */}
        <div className="relative bg-black" style={{ aspectRatio: '1' }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Viewfinder */}
          {!error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-52 h-52">
                {/* Coins du cadre */}
                {[
                  'top-0 left-0 border-t-4 border-l-4 rounded-tl-xl',
                  'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl',
                  'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
                  'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl',
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-8 h-8 border-gold ${cls}`} />
                ))}
                {/* Ligne de scan animée */}
                <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2
                  h-0.5 bg-gold/70 animate-pulse" />
              </div>
            </div>
          )}

          {/* Loading */}
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="w-8 h-8 border-2 border-gold/30 border-t-gold
                rounded-full animate-spin" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
              <div className="text-center">
                <p className="text-4xl mb-3">📷</p>
                <p className="text-white text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 py-3 px-4">
          Le code sera automatiquement détecté et ajouté au ticket
        </p>
      </div>
    </div>
  );
}
