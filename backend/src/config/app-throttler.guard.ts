import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Garde de limitation de débit — remplace le ThrottlerGuard standard.
 *
 * Le guard standard identifie le client par req.ip. Derrière nos proxys
 * (Netlify → Render), req.ip est calculé depuis l'en-tête X-Forwarded-For…
 * que le client peut forger : un attaquant qui présente une IP différente à
 * chaque requête obtient un compteur neuf à chaque fois, et la limite ne se
 * déclenche jamais. Aucun réglage de TRUST_PROXY_HOPS ne corrige cela — le
 * nombre de sauts réel diffère entre le chemin Netlify et l'accès direct à
 * l'URL Render, donc toute valeur fixe est fausse pour l'un des deux chemins.
 *
 * Pour les routes d'authentification, on indexe donc le compteur sur le
 * COMPTE VISÉ (l'email du corps de requête), qui est inforgeable par nature :
 *
 *  - force brute sur un compte : bloquée quelle que soit l'IP présentée ;
 *  - caissiers d'une boutique derrière la même IP publique : jamais bloqués
 *    collectivement, chacun a son propre compteur (un compte = un email).
 *
 * Les autres routes gardent req.ip : leurs limites sont larges (100 à
 * 300/min) et servent de garde-fou anti-emballement, pas de défense
 * anti-attaque.
 *
 * Limite résiduelle assumée : un attaquant qui tourne à la fois les IP ET
 * les emails (password spraying) n'est freiné par aucun compteur individuel.
 * La vraie parade est applicative (verrouillage progressif par compte,
 * CAPTCHA) — hors périmètre de ce correctif, consigné dans AUDIT-SAAS.md.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const email =
      typeof req.body?.email === 'string' && req.body.email.trim() !== ''
        ? req.body.email.trim().toLowerCase()
        : null;

    if (email && req.path?.endsWith('/auth/login'))           return `login:${email}`;
    if (email && req.path?.endsWith('/auth/forgot-password')) return `forgot:${email}`;

    return req.ip;
  }
}
