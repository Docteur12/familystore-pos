import React, { useRef, useState } from 'react';
import { Product } from '../api/products';
import { authHeaders } from '../api/http';
import { sansAccents } from '../utils/text';

/**
 * Export / Import de la liste complète des produits au format Excel (CSV « ; »).
 * - Export : toutes les caractéristiques, fichier qui s'ouvre en colonnes dans Excel.
 * - Import : correspondance par code-barres puis nom ; une cellule vide ne modifie
 *   rien ; une ligne inconnue crée le produit. Confirmation avant application.
 * Utilisé par le catalogue du gestionnaire ET l'espace magasinier.
 */

const COLONNES = [
  'Code-barres', 'Nom', 'Nom local', 'Catégorie', 'Sous-catégorie', 'Unité', 'Valeur',
  'Prix vente', 'Prix achat', 'Réduction %', 'Stock boutique', 'Stock entrepôt',
  'Seuil alerte', 'Seuil commande', 'Péremption (AAAA-MM-JJ)', 'Fournisseur',
] as const;

// En-tête CSV (normalisé sans accents) → clé backend
const CLE_PAR_ENTETE: Record<string, string> = {
  'code-barres': 'barcode', 'code barres': 'barcode', 'barcode': 'barcode',
  'nom': 'name', 'nom local': 'localName',
  'categorie': 'category', 'sous-categorie': 'subCategory', 'sous categorie': 'subCategory',
  'unite': 'unit', 'valeur': 'valeur',
  'prix vente': 'price', 'prix achat': 'costPrice', 'reduction %': 'discount', 'reduction': 'discount',
  'stock boutique': 'stock', 'stock': 'stock', 'stock entrepot': 'stockMagazin',
  'seuil alerte': 'alertThreshold', 'seuil commande': 'magazinierThreshold',
  'peremption (aaaa-mm-jj)': 'expiryDate', 'peremption': 'expiryDate',
  'fournisseur': 'fournisseur',
};

// Parseur CSV tolérant : « ; » ou « , », guillemets Excel
function parseLigne(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  const sep = line.includes(';') ? ';' : ',';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

interface Rapport { crees: number; modifies: number; erreurs: { ligne: number; nom: string; message: string }[] }

export default function ImportExportProduits({ products, onImported, addToast }: {
  products: Product[];
  onImported: () => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [aConfirmer, setAConfirmer] = useState<Array<Record<string, string>> | null>(null);
  const [rapport, setRapport] = useState<Rapport | null>(null);

  // ── Export : vrai fichier Excel (.xlsx) généré par le serveur ──────────────
  // (repli : CSV local si le serveur est injoignable, pour ne jamais bloquer)
  const [exporting, setExporting] = useState(false);
  const telecharger = (blob: Blob, nomFichier: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const exporterCsvLocal = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const dateStr = (d?: string | Date | null) => {
      if (!d) return '';
      const x = new Date(d);
      return isNaN(x.getTime()) ? '' : x.toISOString().slice(0, 10);
    };
    const lignes = products.map(p => [
      p.barcode ?? '', p.name, p.localName ?? '', p.category ?? '', p.subCategory ?? '',
      p.unit ?? '', p.valeur ?? '', p.price, p.costPrice ?? 0, p.discount ?? 0,
      p.stock, p.stockMagazin ?? 0, p.alertThreshold ?? 0, p.magazinierThreshold ?? 0,
      dateStr(p.expiryDate), p.fournisseur ?? '',
    ].map(esc).join(';'));
    const csv = [COLONNES.map(c => `"${c}"`).join(';'), ...lignes].join('\r\n');
    telecharger(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), `produits_${new Date().toISOString().slice(0, 10)}.csv`);
    addToast(`Export prêt — ${products.length} produits (fichier CSV)`, 'success');
  };

  const exporter = async () => {
    if (products.length === 0) { addToast('Aucun produit à exporter', 'error'); return; }
    setExporting(true);
    try {
      const res = await fetch('/api/products/export-excel', { headers: authHeaders() });
      if (!res.ok) throw new Error('export serveur indisponible');
      telecharger(await res.blob(), `produits_${new Date().toISOString().slice(0, 10)}.xlsx`);
      addToast(`Export prêt — ${products.length} produits (fichier Excel, dans Téléchargements)`, 'success');
    } catch {
      exporterCsvLocal();
    } finally { setExporting(false); }
  };

  // ── Import : lecture + préparation ─────────────────────────────────────────
  // Accepte le vrai format Excel (.xlsx, lu par le serveur) ET le CSV.
  const lireFichier = async (file: File) => {
    const nom = file.name.toLowerCase();
    try {
      if (nom.endsWith('.xls') && !nom.endsWith('.xlsx')) {
        addToast('Ancien format Excel (.xls) non pris en charge — dans Excel, faites « Enregistrer sous » → « Classeur Excel (.xlsx) »', 'error');
        return;
      }
      if (nom.endsWith('.xlsx')) {
        // Fichier Excel : lecture côté serveur
        const base64 = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result).split(',')[1] ?? '');
          fr.onerror = () => reject(new Error('lecture impossible'));
          fr.readAsDataURL(file);
        });
        const res = await fetch('/api/products/parse-excel', {
          method: 'POST', headers: authHeaders(), body: JSON.stringify({ fileBase64: base64 }),
        });
        if (!res.ok) {
          const msg = (await res.json().catch(() => ({}))).message;
          addToast(typeof msg === 'string' ? msg : 'Fichier Excel illisible', 'error');
          return;
        }
        const { rows } = await res.json();
        if (!rows?.length) { addToast('Aucune ligne exploitable dans le fichier', 'error'); return; }
        setAConfirmer(rows);
        return;
      }

      // CSV : lecture locale
      const texte = (await file.text()).replace(/^﻿/, '');
      const lignes = texte.split(/\r?\n/).filter(l => l.trim());
      if (lignes.length < 2) { addToast('Fichier vide — exportez d\'abord un modèle puis remplissez-le', 'error'); return; }
      const entetes = parseLigne(lignes[0]).map(h => sansAccents(h.trim()));
      const cles = entetes.map(h => CLE_PAR_ENTETE[h] ?? null);
      if (!cles.includes('name') && !cles.includes('barcode')) {
        addToast('Colonnes non reconnues — gardez les en-têtes du fichier exporté (Nom, Code-barres…)', 'error');
        return;
      }
      const rows = lignes.slice(1).map(l => {
        const cells = parseLigne(l);
        const row: Record<string, string> = {};
        cles.forEach((k, i) => { if (k && cells[i] !== undefined) row[k] = cells[i].trim(); });
        return row;
      }).filter(r => (r.name ?? '') !== '' || (r.barcode ?? '') !== '');
      if (rows.length === 0) { addToast('Aucune ligne exploitable dans le fichier', 'error'); return; }
      setAConfirmer(rows);
    } catch {
      addToast('Erreur de lecture du fichier', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Import : application après confirmation ────────────────────────────────
  const appliquer = async () => {
    if (!aConfirmer) return;
    setBusy(true);
    try {
      const res = await fetch('/api/products/import-bulk', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ rows: aConfirmer }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Erreur import');
      const r: Rapport = await res.json();
      setAConfirmer(null);
      setRapport(r);
      addToast(`Import terminé : ${r.crees} créé(s), ${r.modifies} modifié(s)${r.erreurs.length ? `, ${r.erreurs.length} erreur(s)` : ''}`, r.erreurs.length ? 'warning' : 'success');
      onImported();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Erreur import', 'error');
    } finally { setBusy(false); }
  };

  const BTN: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
    border: '1.5px solid var(--fs-line-2)', borderRadius: 'var(--fs-r-md, 8px)',
    background: '#fff', color: 'var(--fs-ink-600)', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--fs-font-sans)',
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) lireFichier(f); }}/>
      <button onClick={exporter} disabled={exporting} title="Télécharger tous les produits en fichier Excel (.xlsx), dans le dossier Téléchargements" style={{ ...BTN, opacity: exporting ? 0.6 : 1 }}>
        ⬇ {exporting ? 'Export…' : 'Export produits'}
      </button>
      <button onClick={() => fileRef.current?.click()} disabled={busy} title="Importer un fichier Excel (.xlsx) ou CSV : met à jour les produits existants et crée les nouveaux" style={{ ...BTN, opacity: busy ? 0.6 : 1 }}>
        ⬆ {busy ? 'Import…' : 'Import produits'}
      </button>

      {/* Confirmation avant application (garde-fou) */}
      {aConfirmer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '26px 30px', maxWidth: 460, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fs-ink-900)', marginBottom: 8 }}>Importer {aConfirmer.length} ligne{aConfirmer.length > 1 ? 's' : ''} ?</div>
            <p style={{ fontSize: 13, color: 'var(--fs-ink-600)', lineHeight: 1.6, margin: '0 0 8px' }}>
              Les produits existants (repérés par <strong>code-barres</strong> ou <strong>nom</strong>) seront <strong>mis à jour</strong>,
              les inconnus seront <strong>créés</strong>.
            </p>
            <p style={{ fontSize: 12, color: 'var(--fs-ink-400)', lineHeight: 1.5, margin: '0 0 18px' }}>
              💡 Une cellule laissée vide ne modifie rien — aucune donnée ne peut être effacée par accident.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setAConfirmer(null)} style={{ flex: 1, padding: '10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: 'var(--fs-ink-500)' }}>
                Annuler
              </button>
              <button onClick={appliquer} disabled={busy} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-wine-700)', color: '#fff', opacity: busy ? 0.7 : 1 }}>
                {busy ? 'Import…' : 'Confirmer l\'import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rapport d'erreurs éventuelles */}
      {rapport && rapport.erreurs.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '26px 30px', maxWidth: 520, width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fs-ink-900)', marginBottom: 8 }}>
              Import terminé — {rapport.crees} créé(s), {rapport.modifies} modifié(s)
            </div>
            <p style={{ fontSize: 13, color: '#b45309', fontWeight: 600, margin: '0 0 10px' }}>{rapport.erreurs.length} ligne(s) n'ont pas pu être traitées :</p>
            <ul style={{ margin: '0 0 18px', paddingLeft: 18 }}>
              {rapport.erreurs.slice(0, 15).map((e, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--fs-ink-600)', marginBottom: 4 }}>
                  Ligne {e.ligne}{e.nom ? ` (${e.nom})` : ''} : {e.message}
                </li>
              ))}
              {rapport.erreurs.length > 15 && <li style={{ fontSize: 12, color: 'var(--fs-ink-400)' }}>… et {rapport.erreurs.length - 15} autre(s)</li>}
            </ul>
            <button onClick={() => setRapport(null)} style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-wine-700)', color: '#fff' }}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
