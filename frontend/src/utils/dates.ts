// Formatage de dates en heure LOCALE.
// Ne pas utiliser toISOString() pour obtenir un jour ou un mois : elle convertit en
// UTC, donc minuit local (Cameroun = UTC+1) devient la veille à 23 h. Symptôme
// observé : le 31 juillet comptabilisé dans le mois d'août.

const p = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD en heure locale */
export const localISODate = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;

/** YYYY-MM en heure locale */
export const localISOMonth = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${p(d.getMonth() + 1)}`;
