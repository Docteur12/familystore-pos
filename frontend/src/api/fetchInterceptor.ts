// Intercepteur global : si une requête API renvoie 401 (token expiré ou
// invalide), on déconnecte proprement et on redirige vers la connexion avec
// un message clair, au lieu d'afficher un « non authentifié » sans issue.
//
// Exclusions :
//  - /api/auth/login  : un 401 = mauvais identifiants (on reste sur la page).
//  - /api/sales       : la caisse gère elle-même ce cas (sauvegarde hors-ligne).
const origFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const res = await origFetch(input, init);
  try {
    if (res.status === 401) {
      const url =
        typeof input === 'string' ? input
        : input instanceof URL    ? input.href
        : (input as Request).url;

      const isApi   = url.includes('/api/');
      const isLogin = url.includes('/api/auth/login');
      const isSale  = url.includes('/api/sales');
      const onLogin = window.location.pathname.startsWith('/login');

      if (isApi && !isLogin && !isSale && !onLogin) {
        localStorage.removeItem('access_token');
        sessionStorage.setItem('session_expired', '1');
        window.location.href = '/login';
      }
    }
  } catch { /* ne jamais casser la requête à cause de l'intercepteur */ }
  return res;
};

export {};
