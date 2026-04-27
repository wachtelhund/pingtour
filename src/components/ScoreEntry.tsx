import { useEffect, useMemo, useState } from 'react';
import { validateScore } from '../scoring';
import type { Match, MatchScore, Player } from '../types';

interface Props {
  open: boolean;
  match: Match | null;
  playerById: Map<string, Player>;
  onClose: () => void;
  onRecord: (matchId: string, winnerSide: 0 | 1, score: MatchScore) => void;
  onClear: (matchId: string) => void;
  /** Latest server error, surfaced so the modal can show e.g. "Invalid score". */
  error?: string | null;
}

const QUICK_SCORES: Array<[number, number]> = [
  [3, 0],
  [3, 1],
  [4, 2],
  [5, 3],
];

export function ScoreEntry({
  open,
  match,
  playerById,
  onClose,
  onRecord,
  onClear,
  error,
}: Props) {
  const [a, setA] = useState<string>('');
  const [b, setB] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open && match) {
      setA(match.score ? String(match.score.a) : '');
      setB(match.score ? String(match.score.b) : '');
      setLocalError(null);
    }
  }, [open, match]);

  const evaluation = useMemo(() => {
    if (a === '' || b === '') return null;
    const ai = Number(a);
    const bi = Number(b);
    if (Number.isNaN(ai) || Number.isNaN(bi)) {
      return { ok: false, reason: 'Invalid number', winner: null as 0 | 1 | null };
    }
    if (ai === bi) {
      return { ok: false, reason: 'Match cannot be a draw', winner: null };
    }
    const winner: 0 | 1 = ai > bi ? 0 : 1;
    const v = validateScore(Math.max(ai, bi), Math.min(ai, bi));
    return { ok: v.ok, reason: v.reason, winner };
  }, [a, b]);

  if (!open || !match) return null;

  const playerA = match.players[0] ? playerById.get(match.players[0]!) : null;
  const playerB = match.players[1] ? playerById.get(match.players[1]!) : null;

  const submit = (winner: 0 | 1) => {
    setLocalError(null);
    const ai = Number(a);
    const bi = Number(b);
    onRecord(match.id, winner, { a: ai, b: bi });
    onClose();
  };

  const reset = () => {
    setLocalError(null);
    onClear(match.id);
    onClose();
  };

  const winFor = (winner: 0 | 1, ws: number, ls: number) => {
    setLocalError(null);
    const score: MatchScore = winner === 0 ? { a: ws, b: ls } : { a: ls, b: ws };
    onRecord(match.id, winner, score);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="src-card w-full max-w-xl p-6 space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <div className="text-xs uppercase tracking-wider text-muted-fg">
            Round {match.round + 1} · Match {match.slot + 1}
          </div>
          <h2 className="text-xl font-semibold mt-1">Record result</h2>
        </header>

        <div className="grid grid-cols-2 gap-4">
          <PlayerInput
            label={playerA?.name ?? 'TBD'}
            value={a}
            onChange={setA}
            isWinner={evaluation?.winner === 0 && evaluation.ok}
          />
          <PlayerInput
            label={playerB?.name ?? 'TBD'}
            value={b}
            onChange={setB}
            isWinner={evaluation?.winner === 1 && evaluation.ok}
          />
        </div>

        {evaluation && !evaluation.ok && (
          <div className="text-sm text-warning">{evaluation.reason}</div>
        )}
        {(localError ?? error) && (
          <div className="text-sm text-destructive">{localError ?? error}</div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            className="src-btn-primary flex-1 h-12 text-base"
            disabled={!evaluation?.ok || evaluation.winner === null}
            onClick={() =>
              evaluation?.winner !== null &&
              evaluation?.winner !== undefined &&
              submit(evaluation.winner)
            }
          >
            Save result
          </button>
          <button type="button" className="src-btn-ghost h-12" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-fg">
            Quick result
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-xs text-muted-fg truncate">
                {playerA?.name ?? 'TBD'} wins
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_SCORES.map(([w, l]) => (
                  <button
                    key={`a-${w}-${l}`}
                    type="button"
                    className="src-btn-ghost text-sm px-3 py-2"
                    onClick={() => winFor(0, w, l)}
                    disabled={!playerA || !playerB}
                  >
                    {w}–{l}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-fg truncate">
                {playerB?.name ?? 'TBD'} wins
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_SCORES.map(([w, l]) => (
                  <button
                    key={`b-${w}-${l}`}
                    type="button"
                    className="src-btn-ghost text-sm px-3 py-2"
                    onClick={() => winFor(1, w, l)}
                    disabled={!playerA || !playerB}
                  >
                    {l}–{w}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {match.winner !== null && (
          <div className="border-t border-border pt-4">
            <button
              type="button"
              className="src-btn-destructive w-full"
              onClick={reset}
            >
              Clear this result
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerInput({
  label,
  value,
  onChange,
  isWinner,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isWinner: boolean;
}) {
  return (
    <div
      className={[
        'rounded-lg border p-4 space-y-2',
        isWinner ? 'border-primary bg-accent/40' : 'border-border bg-bg',
      ].join(' ')}
    >
      <div className="text-sm text-muted-fg truncate">{label}</div>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        className="src-input text-center text-3xl font-bold tabular-nums h-16"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
