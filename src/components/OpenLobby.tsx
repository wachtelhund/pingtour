import { useState } from 'react';
import { useRealtime } from '../realtime';

export function OpenLobby() {
  const { createLobby } = useRealtime();
  const [name, setName] = useState('Sourceful Open');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createLobby(name);
  };

  return (
    <form onSubmit={submit} className="src-card p-6 space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Open a tournament lobby</h2>
        <p className="text-sm text-muted-fg">
          A QR code will appear on the TV. Players scan to add themselves.
          You can also add players manually after opening the lobby.
        </p>
      </header>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Tournament name</label>
        <input
          autoFocus
          className="src-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Sourceful Open"
        />
      </div>

      <button type="submit" className="src-btn-primary w-full h-12 text-base">
        Open lobby →
      </button>
    </form>
  );
}
