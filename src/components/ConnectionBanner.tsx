import type { ConnectionState } from '../realtime';

interface Props {
  connection: ConnectionState;
}

export function ConnectionBanner({ connection }: Props) {
  if (connection === 'open') return null;
  const label =
    connection === 'connecting' ? 'Connecting…' : 'Disconnected — retrying';
  return (
    <div className="bg-warning text-warning-fg px-4 py-2 text-center text-sm font-medium">
      {label}
    </div>
  );
}
