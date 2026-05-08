import React, { useCallback, useEffect, useState } from 'react';
import { createUser, getUsers, updateUser, UserRecord } from '../api/auth';
import { getTokenPayload } from '../api/dashboard';

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  mode:    'create' | 'edit';
  role?:   'caissier' | 'gestionnaire';
  user?:   UserRecord;
  onSave:  (data: { name: string; email?: string; password: string }) => Promise<void>;
  onClose: () => void;
}

function UserModal({ mode, role, user, onSave, onClose }: ModalProps) {
  const [name,     setName]     = useState(user?.name     ?? '');
  const [email,    setEmail]    = useState(user?.email    ?? '');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const roleLabel = role === 'gestionnaire' ? 'Chef de stock' : 'Caissier(e)';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'create' && !password.trim()) {
      setError('Le mot de passe est obligatoire');
      return;
    }
    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        email: email.trim() || undefined,
        password: password.trim(),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
      flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        <div className="bg-bordeaux px-6 py-4">
          <p className="text-gold font-black text-base tracking-wide">
            {mode === 'create' ? `Nouveau compte ${roleLabel}` : 'Modifier le compte'}
          </p>
          {mode === 'create' && role && (
            <p className="text-cream/70 text-xs mt-0.5">Rôle : {roleLabel}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase
              tracking-wider mb-1.5">
              Nom affiché
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              placeholder={role === 'gestionnaire' ? 'Gestionnaire 1' : 'Caisse 1'}
              className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200
                focus:border-bordeaux outline-none text-sm bg-cream/40"
            />
          </div>

          {mode === 'create' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase
                tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="caisse1@familystore.cm"
                className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200
                  focus:border-bordeaux outline-none text-sm bg-cream/40"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase
              tracking-wider mb-1.5">
              {mode === 'edit' ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe'}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required={mode === 'create'}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200
                focus:border-bordeaux outline-none text-sm bg-cream/40"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700
              rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
              <span>✕</span>{error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-bordeaux hover:bg-bordeaux-dark disabled:opacity-50
                text-cream font-bold text-sm rounded-xl border-2 border-gold transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-cream/30 border-t-cream
                    rounded-full animate-spin" />
                  Enregistrement…
                </span>
              ) : mode === 'create' ? 'Créer le compte' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm
                font-bold text-gray-600 hover:bg-cream transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Role section ──────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  patron:       'bg-bordeaux/10 text-bordeaux border-bordeaux/20',
  caissier:     'bg-blue-50 text-blue-700 border-blue-200',
  gestionnaire: 'bg-amber-50 text-amber-700 border-amber-200',
};

const ROLE_LABELS: Record<string, string> = {
  patron:       'Patron',
  caissier:     'Caissier(e)',
  gestionnaire: 'Gestionnaire',
};

// ── Main page ─────────────────────────────────────────────────────────────────

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; role: 'caissier' | 'gestionnaire' }
  | { open: true; mode: 'edit';   user: UserRecord };

export default function Utilisateurs() {
  const [users,   setUsers]   = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [modal,   setModal]   = useState<ModalState>({ open: false });
  const [success, setSuccess] = useState<string | null>(null);

  const payload = getTokenPayload();
  const myId    = payload?.sub;

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setUsers(await getUsers()); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erreur'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const caissiers     = users.filter(u => u.role === 'caissier');
  const gestionnaires = users.filter(u => u.role === 'gestionnaire');
  const patrons       = users.filter(u => u.role === 'patron');

  // next auto-name
  const nextName = (role: 'caissier' | 'gestionnaire', list: UserRecord[]) => {
    const prefix = role === 'caissier' ? 'Caisse' : 'Gestionnaire';
    return `${prefix} ${list.length + 1}`;
  };

  const handleCreate = async (data: { name: string; email?: string; password: string }) => {
    if (modal.open && modal.mode === 'create') {
      const created = await createUser({
        name:     data.name,
        email:    data.email!,
        password: data.password,
        role:     modal.role,
      });
      setUsers(prev => [...prev, created]);
      setModal({ open: false });
      flash(`Compte "${created.name}" créé avec succès`);
    }
  };

  const handleEdit = async (data: { name: string; password: string }) => {
    if (modal.open && modal.mode === 'edit') {
      const updated = await updateUser(modal.user._id, {
        name:     data.name     || undefined,
        password: data.password || undefined,
      });
      setUsers(prev => prev.map(u => u._id === updated._id ? updated : u));
      setModal({ open: false });
      flash(`Compte "${updated.name}" modifié`);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 flex items-center justify-between
        px-6 py-3 shrink-0 shadow-sm">
        <h2 className="font-bold text-bordeaux text-lg">Utilisateurs</h2>
        <p className="text-gray-400 text-xs hidden md:block">
          Gérez les comptes de votre équipe
        </p>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 flex flex-col gap-6">

        {/* Feedback */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl
            px-4 py-3 text-sm flex items-center gap-2">
            <span>✕</span>{error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl
            px-4 py-3 text-sm flex items-center gap-2">
            <span>✓</span>{success}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-bordeaux/20 border-t-bordeaux
              rounded-full animate-spin" />
          </div>
        )}

        {!loading && (
          <>
            {/* Mon compte */}
            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Mon compte
              </h3>
              <div className="bg-white rounded-2xl shadow border border-cream-dark overflow-hidden">
                {patrons.map(u => (
                  <div key={u._id}
                    className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0
                      border-gray-50">
                    <div className="w-10 h-10 rounded-full bg-bordeaux text-cream
                      flex items-center justify-center font-black text-sm shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border
                      ${ROLE_COLORS[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                    <button
                      onClick={() => setModal({ open: true, mode: 'edit', user: u })}
                      className="text-xs text-bordeaux hover:underline font-semibold"
                    >
                      Modifier
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Caissiers */}
            <UserSection
              title="Caissiers"
              users={caissiers}
              myId={myId}
              onEdit={u => setModal({ open: true, mode: 'edit', user: u })}
              onAdd={() => setModal({ open: true, mode: 'create', role: 'caissier' })}
              addLabel={`+ Ajouter ${nextName('caissier', caissiers)}`}
            />

            {/* Gestionnaires */}
            <UserSection
              title="Gestionnaires de stock"
              users={gestionnaires}
              myId={myId}
              onEdit={u => setModal({ open: true, mode: 'edit', user: u })}
              onAdd={() => setModal({ open: true, mode: 'create', role: 'gestionnaire' })}
              addLabel={`+ Ajouter ${nextName('gestionnaire', gestionnaires)}`}
            />
          </>
        )}
      </main>

      {/* Modal */}
      {modal.open && modal.mode === 'create' && (
        <UserModal
          mode="create"
          role={modal.role}
          onSave={handleCreate}
          onClose={() => setModal({ open: false })}
        />
      )}
      {modal.open && modal.mode === 'edit' && (
        <UserModal
          mode="edit"
          user={modal.user}
          onSave={handleEdit}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  );
}

// ── UserSection ───────────────────────────────────────────────────────────────

interface UserSectionProps {
  title:    string;
  users:    UserRecord[];
  myId:     string | undefined;
  onEdit:   (u: UserRecord) => void;
  onAdd:    () => void;
  addLabel: string;
}

function UserSection({ title, users, myId, onEdit, onAdd, addLabel }: UserSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          {title} ({users.length})
        </h3>
        <button
          onClick={onAdd}
          className="text-xs font-bold text-bordeaux hover:text-bordeaux-dark
            bg-bordeaux/10 hover:bg-bordeaux/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          {addLabel}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow border border-cream-dark overflow-hidden">
        {users.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-300">
            <p className="text-3xl mb-2">👤</p>
            <p className="text-sm">Aucun compte pour le moment</p>
          </div>
        ) : (
          users.map((u, i) => (
            <div key={u._id}
              className={`flex items-center gap-4 px-5 py-4
                ${i < users.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <div className="w-9 h-9 rounded-full bg-cream border border-gray-200
                flex items-center justify-center font-bold text-gray-500 text-sm shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{u.name}</p>
                <p className="text-xs text-gray-400">{u.email}</p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border
                ${ROLE_COLORS[u.role]}`}>
                {ROLE_LABELS[u.role]}
              </span>
              <button
                onClick={() => onEdit(u)}
                className="text-xs text-bordeaux hover:underline font-semibold shrink-0"
              >
                Modifier
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
