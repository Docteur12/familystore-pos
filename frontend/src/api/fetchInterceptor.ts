// Intercepteur global :
//  1. si une requête API renvoie 401 (token expiré ou invalide), on déconnecte
//     proprement et on redirige vers la connexion avec un message clair, au
//     lieu d'afficher un « non authentifié » sans issue ;
//  2. en interface anglaise, les messages d'erreur du backend (français) sont
//     traduits à la volée (i18n/backend-messages.ts) — le serveur reste
//     monolingue et sert indifféremment un magasin FR ou EN.
//
// Exclusions du 1. :
//  - /api/auth/login  : un 401 = mauvais identifiants (on reste sur la page).
//  - /api/sales       : la caisse gère elle-même ce cas (sauvegarde hors-ligne).
import { getLang } from '../i18n';
import { translateBackendMessage } from '../i18n/backend-messages';

const origFetch = window.fetch.bind(window);

// Réponse d'erreur JSON dont le champ « message » (string ou string[]) est traduit.
async function translateErrorBody(res: Response): Promise<Response> {
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return res;
  try {
    const body = await res.clone().json();
    if (!body || typeof body !== 'object' || !('message' in body)) return res;
    const msg = (body as any).message;
    const translated = Array.isArray(msg) ? msg.map(translateBackendMessage) : translateBackendMessage(msg);
    if (JSON.stringify(translated) === JSON.stringify(msg)) return res;
    return new Response(JSON.stringify({ ...body, message: translated }), {
      status: res.status, statusText: res.statusText, headers: res.headers,
    });
  } catch { return res; }
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let res = await origFetch(input, init);
  try {
    const url =
      typeof input === 'string' ? input
      : input instanceof URL    ? input.href
      : (input as Request).url;
    const isApi = url.includes('/api/');

    if (res.status === 401) {
      const isLogin = url.includes('/api/auth/login');
      const isSale  = url.includes('/api/sales');
      const onLogin = window.location.pathname.startsWith('/login');

      if (isApi && !isLogin && !isSale && !onLogin) {
        localStorage.removeItem('access_token');
        sessionStorage.setItem('session_expired', '1');
        window.location.href = '/login';
      }
    }

    if (isApi && !res.ok && getLang() === 'en') res = await translateErrorBody(res);
  } catch { /* ne jamais casser la requête à cause de l'intercepteur */ }
  return res;
};

export {};
