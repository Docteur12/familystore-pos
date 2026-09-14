// @vitest-environment jsdom
/**
 * Impression du ticket — dans un cadre caché, jamais dans une fenêtre.
 *
 * Constaté chez Radiance le 14/09/2026 : au clic « Print », le caissier voyait
 * « Please allow popups to print » et rien ne sortait. Le ticket s'ouvrait
 * dans une fenêtre séparée, que Chrome bloque dès que la permission du clic a
 * été consommée par autre chose. Ce test verrouille le remède :
 *  - aucune fenêtre n'est jamais ouverte, aucun message d'alerte ;
 *  - le ticket part dans un cadre de la page, imprimé UNE fois ;
 *  - N copies = un seul travail d'impression, une page par copie ;
 *  - le cadre ne s'accumule pas et disparaît après l'impression.
 *
 * Le docblock force jsdom : ce fichier doit pouvoir tourner même là où la
 * configuration Vitest ne le pose pas.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { doPrint } from './ReceiptPrint';

const TICKET = `<!DOCTYPE html>
<html lang="en"><head><style>@page { size: 80mm auto; margin: 0; } .total { font-weight: 900; }</style></head>
<body><div class="total">Total: 100 FCFA</div><div>Antacid Tablets</div></body></html>`;

const cadres = () => Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[data-impression-ticket]'));

/** Espionne `print` du cadre créé, AVANT que la minuterie ne le déclenche. */
function espionnerImpression(cadre: HTMLIFrameElement) {
  // jsdom n'implémente ni focus ni print : on les neutralise, on observe print.
  vi.spyOn(cadre.contentWindow as Window, 'focus').mockImplementation(() => {});
  return vi.spyOn(cadre.contentWindow as Window, 'print').mockImplementation(() => {});
}

describe('impression du ticket — sans fenêtre pop-up', () => {
  let ouvrir: MockInstance<Parameters<typeof window.open>, ReturnType<typeof window.open>>;
  let alerte: MockInstance<Parameters<typeof window.alert>, void>;

  beforeEach(() => {
    vi.useFakeTimers();
    ouvrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    alerte = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    cadres().forEach(c => c.remove());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('TÉMOIN DU DÉFAUT — n’ouvre JAMAIS de fenêtre ni d’alerte, même quand le navigateur bloquerait', async () => {
    // `window.open` renvoie null : c'est exactement ce que fait Chrome quand
    // il bloque. L'ancien code ouvrait une fenêtre puis affichait l'alerte —
    // ce test échoue sur ces deux assertions contre lui.
    doPrint(TICKET, 2);
    const [cadre] = cadres();
    if (cadre) espionnerImpression(cadre);
    await vi.runAllTimersAsync();
    expect(ouvrir).not.toHaveBeenCalled();
    expect(alerte).not.toHaveBeenCalled();
  });

  it('imprime le ticket dans un cadre caché, une seule fois, styles compris', async () => {
    doPrint(TICKET, 1);
    const [cadre] = cadres();
    expect(cadres()).toHaveLength(1);
    expect(cadre.style.width).toBe('0px');
    expect(cadre.getAttribute('aria-hidden')).toBe('true');

    const doc = cadre.contentDocument!;
    expect(doc.body.textContent).toContain('Total: 100 FCFA');
    expect(doc.head.innerHTML).toContain('@page');
    expect(doc.documentElement.lang).toBe('en');

    const imprimer = espionnerImpression(cadre);
    await vi.runAllTimersAsync();
    expect(imprimer).toHaveBeenCalledTimes(1);
  });

  it('N copies = UN seul travail d’impression, une page par copie', async () => {
    doPrint(TICKET, 3);
    const [cadre] = cadres();
    const doc = cadre.contentDocument!;
    expect(doc.querySelectorAll('.copie-ticket')).toHaveLength(3);
    expect(doc.body.textContent!.match(/Antacid Tablets/g)).toHaveLength(3);
    expect(doc.head.innerHTML).toMatch(/break-after:\s*page/);

    const imprimer = espionnerImpression(cadre);
    await vi.runAllTimersAsync();
    expect(imprimer).toHaveBeenCalledTimes(1);
  });

  it('un nombre de copies absurde retombe sur une copie', () => {
    for (const copies of [0, -2, Number.NaN]) {
      doPrint(TICKET, copies);
      expect(cadres()[0].contentDocument!.querySelectorAll('.copie-ticket')).toHaveLength(1);
    }
  });

  it('un clic répété ne laisse pas s’accumuler les cadres', () => {
    doPrint(TICKET, 1);
    doPrint(TICKET, 1);
    doPrint(TICKET, 1);
    expect(cadres()).toHaveLength(1);
  });

  it('le cadre disparaît après l’impression', async () => {
    doPrint(TICKET, 1);
    const [cadre] = cadres();
    espionnerImpression(cadre);
    await vi.advanceTimersByTimeAsync(100);
    cadre.contentWindow!.dispatchEvent(new Event('afterprint'));
    expect(cadres()).toHaveLength(0);
  });
});
