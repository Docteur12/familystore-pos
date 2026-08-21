// Traduction côté client des messages d'erreur renvoyés par le backend.
//
// Le backend reste monolingue (français) : un même serveur peut servir un
// magasin FR et un magasin EN, et il n'a pas de notion de langue par requête.
// L'intercepteur fetch (api/fetchInterceptor.ts) applique cette table aux
// réponses d'erreur JSON quand l'interface est en anglais.
//
// Un message inconnu est rendu tel quel. Les motifs à variables (noms de
// produit, quantités…) sont couverts par des expressions régulières.

const EXACT: Record<string, string> = {
  'Accès non autorisé':                                   'Access denied',
  'Accès refusé : rôle insuffisant':                      'Access denied: insufficient role',
  'Agence introuvable':                                   'Branch not found',
  'Ajoutez au moins un produit à retourner':              'Add at least one product to return',
  'Ancien mot de passe incorrect':                        'Old password is incorrect',
  'Aucun produit à envoyer.':                             'No products to send.',
  'Aucune quantité à livrer':                             'No quantity to deliver',
  'Aucune session active':                                'No active session',
  'Bon de livraison déjà généré pour cette commande':     'Delivery note already generated for this order',
  'Caisse introuvable':                                   'Cash register not found',
  'Ce code-barres est déjà utilisé par un autre produit': 'This barcode is already used by another product',
  'Cet email est déjà utilisé':                           'This email is already in use',
  'Cette commande a déjà été entièrement livrée — la livraison existe déjà (doublon évité).':
                                                          'This order has already been fully delivered — the delivery already exists (duplicate avoided).',
  'Classeur Excel vide':                                  'Empty Excel workbook',
  'Colonnes non reconnues — gardez les en-têtes du fichier exporté (Nom, Code-barres…)':
                                                          'Unrecognised columns — keep the headers of the exported file (Name, Barcode…)',
  'Commande déjà (partiellement) livrée : impossible de modifier les produits. Annulez-la plutôt.':
                                                          'Order already (partially) delivered: products cannot be changed. Cancel it instead.',
  'Commande introuvable':                                 'Order not found',
  'Demande déjà traitée':                                 'Request already processed',
  'Demande introuvable':                                  'Request not found',
  'Demande non encore envoyée':                           'Request not yet shipped',
  'Dépense introuvable':                                  'Expense not found',
  'Email ou mot de passe incorrect':                      'Incorrect email or password',
  'Envoi introuvable':                                    'Shipment not found',
  'Fichier manquant':                                     'Missing file',
  'Fournisseur introuvable':                              'Supplier not found',
  'Fournisseur requis':                                   'Supplier is required',
  'La quantité doit être un nombre positif':              'Quantity must be a positive number',
  'Livraison introuvable':                                'Delivery not found',
  'Montant invalide':                                     'Invalid amount',
  'Partenaire introuvable':                               'Partner not found',
  'Produit introuvable':                                  'Product not found',
  'Quantité invalide':                                    'Invalid quantity',
  'Retour introuvable':                                   'Return not found',
  'Token invalide ou expiré':                             'Invalid or expired token',
  'Token manquant':                                       'Missing token',
  'Une livraison doit garder au moins un produit — utilisez plutôt la suppression.':
                                                          'A delivery must keep at least one product — use deletion instead.',
  'Utilisateur introuvable':                              'User not found',
  'Vente introuvable':                                    'Sale not found',
  'Versement introuvable':                                'Payment not found',
  'Vous ne pouvez fermer que votre propre session':       'You can only close your own session',
  'Seul un envoi en transit (non encore reçu) peut être annulé':
                                                          'Only a shipment in transit (not yet received) can be cancelled',
  'Si un compte existe avec cet email, un message a été envoyé.':
                                                          'If an account exists with this email, a message has been sent.',
  'Trop de tentatives, réessayez plus tard.':             'Too many attempts, please try again later.',
};

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Aucun produit avec le code "(.+)"$/,                       m => `No product with code "${m[1]}"`],
  [/^Le code (.+) est déjà utilisé$/,                           m => `Code ${m[1]} is already in use`],
  [/^Produit introuvable : (.+)$/,                              m => `Product not found: ${m[1]}`],
  [/^Stock (boutique|entrepôt) insuffisant pour « (.+) » : (.+?) (?:disponible\(s\)|en stock), (.+?) (?:demandé\(s\)|à retourner)\.$/,
    m => `Insufficient ${m[1] === 'boutique' ? 'store' : 'warehouse'} stock for "${m[2]}": ${m[3]} available, ${m[4]} requested.`],
  [/^Stock insuffisant pour (.+)$/,                             m => `Insufficient stock for ${m[1]}`],
];

export function translateBackendMessage(msg: string): string {
  if (typeof msg !== 'string' || !msg) return msg;
  const exact = EXACT[msg];
  if (exact) return exact;
  for (const [re, fn] of PATTERNS) {
    const m = msg.match(re);
    if (m) return fn(m);
  }
  return msg;
}
