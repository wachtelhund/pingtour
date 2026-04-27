import { useEffect, useState } from 'react';
import { Logo } from '../components/Logo';
import { useRealtime } from '../realtime';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { navigate } from '../router';

export function AdminLogin() {
  const { login, authError, connection } = useRealtime();
  const [pw, setPw] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Clear our local "submitted" flag when a server-side error arrives.
  useEffect(() => {
    if (authError) setSubmitted(false);
  }, [authError]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw) return;
    setSubmitted(true);
    login(pw);
  };

  const disabled = !pw || connection !== 'open' || submitted;

  return (
    <div className="min-h-full">
      <ConnectionBanner connection={connection} />
      <div className="flex items-center justify-center p-6 min-h-[calc(100vh-2rem)]">
        <form
          onSubmit={submit}
          className="src-card w-full max-w-sm p-6 space-y-5"
        >
          <header className="flex items-center gap-3">
            <Logo size={32} />
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                Pingtour Admin
              </h1>
              <p className="text-xs text-muted-fg">Score entry</p>
            </div>
          </header>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              autoFocus
              inputMode="text"
              autoComplete="current-password"
              className="src-input text-base h-12"
              value={pw}
              onChange={e => {
                setPw(e.target.value);
                setSubmitted(false);
              }}
              placeholder="••••••••"
            />
            {authError && (
              <div className="text-sm text-destructive">{authError}</div>
            )}
            {connection !== 'open' && (
              <div className="text-sm text-warning">
                Waiting for server connection…
              </div>
            )}
          </div>

          <button
            type="submit"
            className="src-btn-primary w-full h-12 text-base"
            disabled={disabled}
          >
            Sign in
          </button>

          <button
            type="button"
            className="src-btn-ghost w-full"
            onClick={() => navigate('/')}
          >
            ← Back to display
          </button>
        </form>
      </div>
    </div>
  );
}
