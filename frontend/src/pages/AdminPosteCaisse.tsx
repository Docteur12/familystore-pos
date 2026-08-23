/**
 * Installer un poste de caisse — imprimante de tickets et tiroir-caisse.
 *
 * Cette page existe pour qu'un commerçant, ou son revendeur, équipe un poste
 * SANS nous appeler. Elle sert les scripts, la marche à suivre, la liste du
 * matériel déjà éprouvé, et — tout aussi utile — ce qui NE marche pas, pour
 * que personne ne reperde le temps qu'on y a passé.
 *
 * Les scripts vivent dans `public/outils/` : un seul exemplaire dans le
 * dépôt, celui-là même que les boutiques téléchargent.
 */
import React, { useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { useIsMobile } from '../hooks/useIsMobile';
import { t } from '../i18n';

// ── Matériel validé ──────────────────────────────────────────────────────────
// Liste volontairement ouverte : chaque poste équipé avec succès s'ajoute ici.
// C'est ce qui permet à un futur client de savoir quoi acheter AVANT de
// s'abonner. N'y inscrire que du matériel réellement mis en service, avec la
// date et la boutique — un modèle « qui devrait marcher » n'a rien à y faire.
type Materiel = {
  type: 'imprimante' | 'tiroir';
  modele: string;
  liaison: string;
  detail: string;
  boutique: string;
  depuis: string;
};

const MATERIEL: Materiel[] = [
  {
    type: 'imprimante',
    modele: 'Epson TM-T20IV',
    liaison: 'USB',
    detail: t(
      'Pilote « EPSON Advanced Printer Driver 6 » (EPSON TM-T(203dpi) Receipt6). Papier 80 mm.',
      '“EPSON Advanced Printer Driver 6” driver (EPSON TM-T(203dpi) Receipt6). 80 mm paper.',
    ),
    boutique: 'Radiance — Bonamoussadi',
    depuis: '22/08/2026',
  },
  {
    // Pour un tiroir, la marque compte peu : ce sont des boîtes presque
    // identiques électriquement. On décrit donc ce qui décide vraiment de la
    // compatibilité, et qui est vérifié. Un modèle précis pourra s'ajouter.
    type: 'tiroir',
    modele: t('Tiroir à impulsion 24 V, ouverture par l’imprimante', '24 V pulse drawer, opened by the printer'),
    liaison: t('RJ11 (fiche type téléphone) sur la prise DK de l’imprimante', 'RJ11 (phone-style plug) into the printer’s DK socket'),
    detail: t(
      'Ouverture sur la broche 2 — le réglage par défaut du script ; certains modèles utilisent la broche 5, le script sait le faire aussi. C’est l’imprimante qui fournit le 24 V : son bloc d’alimentation d’origine est indispensable. À l’achat, ces trois points suffisent — la marque n’a pas d’importance.',
      'Opens on pin 2 — the script’s default; some models use pin 5, which the script also handles. The printer supplies the 24 V, so its original power adapter is essential. When buying, those three points are all that matter — the brand does not.',
    ),
    boutique: 'Radiance — Bonamoussadi',
    depuis: '22/08/2026',
  },
];

// ── Étapes ───────────────────────────────────────────────────────────────────

const ETAPES: { titre: string; texte: string; commande?: string }[] = [
  {
    titre: t('Brancher et allumer', 'Connect and power on'),
    texte: t(
      'Imprimante reliée au PC en USB et allumée. Rouleau 80 mm en place, capot bien fermé. Tiroir relié à la prise DK de l’imprimante (fiche type téléphone), clé en position déverrouillée.',
      'Printer connected to the PC by USB and switched on. 80 mm roll loaded, cover firmly closed. Drawer plugged into the printer’s DK socket (phone-style connector), key unlocked.',
    ),
  },
  {
    titre: t('Installer le pilote Epson', 'Install the Epson driver'),
    texte: t(
      'Télécharger « EPSON Advanced Printer Driver 6 » pour VOTRE modèle sur download-center.epson.com (version Europe/Middle East/Africa) et l’installer. S’il termine par « L’enregistrement de l’imprimante a échoué », ce n’est pas grave : l’étape suivante s’en occupe. Astuce : si vous équipez plusieurs postes, posez le fichier téléchargé à côté des deux scripts — le script le repère et l’ouvre tout seul, plus besoin d’Internet sur le poste.',
      'Download “EPSON Advanced Printer Driver 6” for YOUR model from download-center.epson.com (Europe/Middle East/Africa edition) and install it. If it ends with “Printer registration failed”, never mind: the next step takes care of it. Tip: if you are setting up several stations, drop the downloaded file next to the two scripts — the script finds it and opens it for you, so the station needs no internet access.',
    ),
  },
  {
    titre: t('Télécharger les deux scripts', 'Download both scripts'),
    texte: t(
      'Les enregistrer dans un même dossier, par exemple un dossier « caisse » sur le Bureau. Ils doivent rester côte à côte : le premier appelle le second.',
      'Save them in the same folder — for example a “pos” folder on the Desktop. They must stay side by side: the first one calls the second.',
    ),
  },
  {
    titre: t('Ouvrir PowerShell en administrateur', 'Open PowerShell as administrator'),
    texte: t(
      'Menu Démarrer, taper « powershell », CLIC DROIT sur « Windows PowerShell », puis « Exécuter en tant qu’administrateur ». Sans ces droits, la création de l’imprimante est refusée — c’est exactement ce qui bloque l’outil Epson.',
      'Start menu, type “powershell”, RIGHT-CLICK “Windows PowerShell”, then “Run as administrator”. Without those rights the printer cannot be created — which is precisely what stops the Epson tool.',
    ),
  },
  {
    titre: t('Lancer l’installation', 'Run the installer'),
    texte: t(
      'Coller la commande ci-dessous. Elle trouve le script toute seule, sur le Bureau ou dans Téléchargements — pas besoin de connaître le nom d’utilisateur Windows. Tout doit s’afficher en [OK], et le tiroir claque à la fin.',
      'Paste the command below. It locates the script on its own, on the Desktop or in Downloads — no need to know the Windows user name. Everything should read [OK], and the drawer clicks at the end.',
    ),
    commande:
      'Set-ExecutionPolicy Bypass -Scope Process -Force\n' +
      '$d = @("$env:USERPROFILE\\Desktop","$env:USERPROFILE\\Downloads") | Where-Object { Test-Path $_ }\n' +
      '$s = Get-ChildItem $d -Recurse -Filter installer-imprimante-ticket.ps1 -ErrorAction SilentlyContinue | Select-Object -First 1\n' +
      'if ($s) { & $s.FullName } else { "Script introuvable - telechargez-le d\'abord." }',
  },
  {
    titre: t('Vérifier par une vraie vente', 'Check with a real sale'),
    texte: t(
      'Encaisser un article et imprimer le ticket. Le ticket sort, puis le tiroir s’ouvre environ trois secondes après. Ce délai est normal : c’est le temps de démarrage de la tâche Windows.',
      'Ring up an item and print the receipt. The receipt comes out, then the drawer opens about three seconds later. That delay is normal — it is the Windows task starting up.',
    ),
  },
];

// ── Pannes ───────────────────────────────────────────────────────────────────

const PANNES: { symptome: string; cause: string; remede: string }[] = [
  {
    symptome: t('Les tickets s’empilent dans la file, rien ne sort', 'Receipts pile up in the queue, nothing comes out'),
    cause: t(
      'L’imprimante est sur le port USB générique de Windows (USB001) au lieu du port du pilote Epson (ESDPRT001). Windows accepte les travaux, le pilote échoue derrière, et l’état passe en Erreur.',
      'The printer sits on the generic Windows USB port (USB001) instead of the Epson driver port (ESDPRT001). Windows accepts the jobs, the driver fails behind, and the status turns to Error.',
    ),
    remede: t('Relancer le script : il détecte le mauvais port, vide la file et bascule l’imprimante.', 'Run the script again: it detects the wrong port, clears the queue and moves the printer over.'),
  },
  {
    symptome: t('Le ticket sort, le tiroir reste fermé', 'The receipt prints, the drawer stays shut'),
    cause: t(
      'Presque toujours matériel : câble non branché sur la prise DK de l’imprimante, clé du tiroir verrouillée, ou alimentation qui n’est pas celle d’origine — c’est l’imprimante qui fournit le 24 V.',
      'Almost always hardware: cable not plugged into the printer’s DK socket, drawer key locked, or a power supply that is not the original one — the printer provides the 24 V.',
    ),
    remede: t(
      'Vérifier ces trois points. Si tout est bon, le tiroir est peut-être câblé sur la broche 5 : relancer tiroir-caisse.ps1 avec -Installer -Broche 5.',
      'Check those three points. If all is well, the drawer may be wired to pin 5: run tiroir-caisse.ps1 again with -Installer -Broche 5.',
    ),
  },
  {
    symptome: t('L’adresse du site et la date s’impriment en haut du ticket', 'The site address and date print at the top of the receipt'),
    cause: t('Les en-têtes de page de Chrome.', 'Chrome’s page headers.'),
    remede: t('Dans la fenêtre d’impression : « Plus de paramètres », décocher « En-têtes et pieds de page ».', 'In the print dialog: “More settings”, untick “Headers and footers”.'),
  },
  {
    symptome: t('« L’enregistrement de l’imprimante a échoué » (outil Epson)', '“Printer registration failed” (Epson tool)'),
    cause: t('L’outil Epson n’a pas les droits administrateur ; la file d’impression n’est donc jamais créée.', 'The Epson tool lacks administrator rights, so the print queue is never created.'),
    remede: t('Ignorer ce message et lancer le script à l’étape 5 : il crée la file lui-même.', 'Ignore that message and run the script from step 5: it creates the queue itself.'),
  },
];

// ── Composants ───────────────────────────────────────────────────────────────

function Carte({ titre, children, accent }: { titre: string; children: React.ReactNode; accent?: string }) {
  return (
    <section style={{
      background: '#fff', border: `1px solid ${accent ?? 'var(--fs-line)'}`,
      borderLeft: `4px solid ${accent ?? 'var(--fs-wine-700)'}`,
      borderRadius: 12, padding: '16px 18px', marginBottom: 18, boxShadow: 'var(--fs-shadow-sm)',
    }}>
      <h2 style={{
        fontSize: 14, fontWeight: 800, color: 'var(--fs-ink-900)', margin: '0 0 12px',
        fontFamily: 'var(--fs-font-display)',
      }}>{titre}</h2>
      {children}
    </section>
  );
}

function BlocCommande({ commande }: { commande: string }) {
  const [copie, setCopie] = useState(false);
  const copier = () => {
    navigator.clipboard.writeText(commande)
      .then(() => { setCopie(true); setTimeout(() => setCopie(false), 2000); })
      .catch(() => { /* presse-papiers refusé : le texte reste sélectionnable */ });
  };
  return (
    <div style={{ position: 'relative', marginTop: 10 }}>
      <pre style={{
        background: 'var(--fs-ink-900)', color: '#e8e8e8', padding: '12px 14px',
        borderRadius: 8, fontSize: 11, lineHeight: 1.6, overflowX: 'auto',
        fontFamily: 'var(--fs-font-mono)', margin: 0, whiteSpace: 'pre',
      }}>{commande}</pre>
      <button onClick={copier} style={{
        position: 'absolute', top: 8, right: 8, padding: '4px 10px', borderRadius: 6,
        border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
        background: copie ? '#5A8B53' : 'rgba(255,255,255,0.15)', color: '#fff',
      }}>{copie ? t('Copié', 'Copied') : t('Copier', 'Copy')}</button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPosteCaisse() {
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024);

  const fichiers = [
    {
      nom: 'installer-imprimante-ticket.ps1',
      desc: t(
        'Crée la file d’impression sur le bon port, la répare si elle vise le mauvais, puis enchaîne sur le tiroir.',
        'Creates the print queue on the right port, repairs it if it points at the wrong one, then sets up the drawer.',
      ),
    },
    {
      nom: 'tiroir-caisse.ps1',
      desc: t(
        'Pose la tâche Windows qui ouvre le tiroir à chaque ticket imprimé. Appelé par le premier ; utilisable seul pour un test.',
        'Installs the Windows task that opens the drawer on every printed receipt. Called by the first one; can be run alone for a test.',
      ),
    },
    {
      nom: 'LISEZ-MOI.txt',
      desc: t('La même marche à suivre, en texte, à joindre au matériel.', 'The same procedure, as plain text, to hand over with the hardware.'),
    },
  ];

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: 'auto', background: 'var(--fs-ivory)' }}>

        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 28px', flexShrink: 0 }}>
          <div style={{ paddingLeft: isMobile ? 52 : 0 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>{t('Système', 'System')}</p>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>
              {t('Installer un poste de caisse', 'Set up a checkout station')}
            </h1>
          </div>
        </div>

        <div style={{ padding: isNarrow ? '16px' : '20px 28px 40px', maxWidth: 900 }}>

          <p style={{ fontSize: 13, color: 'var(--fs-ink-700)', lineHeight: 1.65, margin: '0 0 20px' }}>
            {t(
              'Imprimante de tickets et tiroir-caisse s’installent en une seule commande, sur le poste lui-même. Comptez dix minutes, pilote Epson compris.',
              'Receipt printer and cash drawer are installed with a single command, on the station itself. Allow ten minutes, Epson driver included.',
            )}
          </p>

          {/* Téléchargements */}
          <Carte titre={t('1. Télécharger', '1. Download')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {fichiers.map(f => (
                <a key={f.nom} href={`/outils/${f.nom}`} download
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
                    border: '1px solid var(--fs-line)', borderRadius: 10, padding: '10px 12px',
                    background: 'var(--fs-ivory)',
                  }}>
                  <span style={{ fontSize: 18 }}>⬇</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--fs-wine-700)', fontFamily: 'var(--fs-font-mono)' }}>{f.nom}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--fs-ink-500)', marginTop: 2, lineHeight: 1.5 }}>{f.desc}</span>
                  </span>
                </a>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--fs-ink-500)', margin: '12px 0 0', lineHeight: 1.6 }}>
              {t(
                'Les deux fichiers .ps1 doivent être enregistrés dans le MÊME dossier.',
                'Both .ps1 files must be saved in the SAME folder.',
              )}
            </p>
          </Carte>

          {/* Étapes */}
          <Carte titre={t('2. La marche à suivre', '2. Step by step')}>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {ETAPES.map(e => (
                <li key={e.titre} style={{ fontSize: 12.5, color: 'var(--fs-ink-700)', lineHeight: 1.65 }}>
                  <strong style={{ color: 'var(--fs-ink-900)' }}>{e.titre}</strong>
                  <div style={{ marginTop: 3 }}>{e.texte}</div>
                  {e.commande && <BlocCommande commande={e.commande}/>}
                </li>
              ))}
            </ol>
          </Carte>

          {/* Matériel validé */}
          <Carte titre={t('3. Matériel déjà éprouvé', '3. Hardware already proven')} accent="#5A8B53">
            <p style={{ fontSize: 12, color: 'var(--fs-ink-500)', margin: '0 0 12px', lineHeight: 1.6 }}>
              {t(
                'Ce matériel a été mis en service avec ces scripts, en boutique. Acheter un modèle de cette liste évite les mauvaises surprises.',
                'This hardware has been put into service with these scripts, in a real shop. Buying from this list avoids unpleasant surprises.',
              )}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--fs-ivory)' }}>
                    {[t('Type', 'Type'), t('Modèle', 'Model'), t('Liaison', 'Connection'), t('En service', 'In service since')].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fs-ink-400)', borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MATERIEL.map(m => (
                    <tr key={m.type + m.modele} style={{ borderBottom: '1px solid var(--fs-line)' }}>
                      <td style={{ padding: '10px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        {m.type === 'imprimante' ? t('Imprimante', 'Printer') : t('Tiroir', 'Drawer')}
                      </td>
                      <td style={{ padding: '10px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, color: 'var(--fs-ink-900)' }}>{m.modele}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--fs-ink-500)', marginTop: 3, lineHeight: 1.5 }}>{m.detail}</div>
                      </td>
                      <td style={{ padding: '10px', verticalAlign: 'top' }}>{m.liaison}</td>
                      <td style={{ padding: '10px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <div>{m.depuis}</div>
                        <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 2 }}>{m.boutique}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--fs-ink-500)', margin: '12px 0 0', lineHeight: 1.6 }}>
              {t(
                'Un poste équipé avec un autre modèle ? Signalez-le : il rejoindra cette liste, qui n’a de valeur que si elle ne contient que du matériel réellement mis en service.',
                'Set up a station with another model? Let us know: it will join this list — which is only worth anything if it holds nothing but hardware actually put into service.',
              )}
            </p>
          </Carte>

          {/* Ce qui ne marche pas */}
          <Carte titre={t('4. Ce qui ne marche pas — et pourquoi', '4. What does not work — and why')} accent="#C23E24">
            <p style={{ fontSize: 12.5, color: 'var(--fs-ink-700)', lineHeight: 1.65, margin: 0 }}>
              <strong>{t('Ouvrir le tiroir depuis le navigateur.', 'Opening the drawer from the browser.')}</strong>{' '}
              {t(
                'L’application a longtemps tenté l’ouverture par Web Serial (navigator.serial). C’est une impasse : l’imprimante de tickets est un périphérique d’IMPRESSION Windows, pas un port série. Elle n’apparaît jamais dans la liste que le navigateur propose. Le seul effet visible était une boîte de dialogue Chrome vide, présentée au caissier à chaque ticket. Ce code a été retiré le 22/08/2026.',
                'The application long tried to open the drawer through Web Serial (navigator.serial). That is a dead end: a receipt printer is a Windows PRINTING device, not a serial port. It never shows up in the list the browser offers. The only visible effect was an empty Chrome dialog, shown to the cashier on every receipt. That code was removed on 22/08/2026.',
              )}
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--fs-ink-700)', lineHeight: 1.65, margin: '12px 0 0' }}>
              {t(
                'Inutile non plus de chercher un réglage de tiroir dans le pilote Epson : sur ce modèle, il n’y en a aucun. Vérifié écran par écran dans les Propriétés Windows, dans l’utilitaire APD et dans PrinterReg. C’est précisément pour cela que le script existe : il envoie l’impulsion d’ouverture lui-même, au niveau du poste.',
                'Nor is there any point hunting for a drawer setting in the Epson driver: on this model there is none. Checked screen by screen in the Windows properties, in the APD utility and in PrinterReg. That is exactly why the script exists: it sends the opening pulse itself, at the workstation.',
              )}
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--fs-ink-700)', lineHeight: 1.65, margin: '12px 0 0' }}>
              <strong>{t('Télécharger le pilote automatiquement.', 'Downloading the driver automatically.')}</strong>{' '}
              {t(
                'Écarté volontairement. Epson sert ses pilotes derrière une acceptation de licence, par des adresses qui changent à chaque version et qu’aucun nom de modèle ne permet de deviner ; son ancien portail download.epson-biz.com a d’ailleurs fermé en juin 2024. Un lien inscrit dans le script finirait par ne plus répondre, chez un client, un jour où personne n’est joignable. Le script fait donc deux choses sûres : il annonce le modèle exact à chercher et ouvre le site Epson — et si le fichier d’installation se trouve à côté de lui, il l’ouvre directement, sans Internet.',
                'Deliberately ruled out. Epson serves its drivers behind a licence agreement, at addresses that change with every version and that no model name lets you guess; its former portal download.epson-biz.com closed in June 2024. A link written into the script would eventually stop answering, at a customer’s site, on a day when nobody is reachable. So the script does two safe things instead: it states the exact model to look for and opens the Epson site — and if the installer file sits next to it, it opens that directly, no internet needed.',
              )}
            </p>
          </Carte>

          {/* Pannes */}
          <Carte titre={t('5. Si quelque chose ne va pas', '5. If something goes wrong')} accent="var(--fs-gold-500)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {PANNES.map(p => (
                <div key={p.symptome} style={{ borderLeft: '2px solid var(--fs-line)', paddingLeft: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{p.symptome}</div>
                  <div style={{ fontSize: 12, color: 'var(--fs-ink-500)', marginTop: 4, lineHeight: 1.6 }}>{p.cause}</div>
                  <div style={{ fontSize: 12, color: 'var(--fs-ink-700)', marginTop: 5, lineHeight: 1.6 }}>
                    <strong>{t('À faire :', 'To do:')}</strong> {p.remede}
                  </div>
                </div>
              ))}
            </div>
          </Carte>

          <p style={{ fontSize: 11.5, color: 'var(--fs-ink-400)', lineHeight: 1.6, margin: 0 }}>
            {t(
              'Les scripts se rejouent sans risque : relancés sur un poste déjà installé, ils le constatent et n’y touchent pas.',
              'The scripts are safe to re-run: on a station already set up, they say so and change nothing.',
            )}
          </p>

        </div>
      </main>
    </div>
  );
}
