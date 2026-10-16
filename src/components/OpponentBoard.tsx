'use client';

import React from 'react';
import { User, Swords, CheckCircle2 } from 'lucide-react';
import { LobbyGuess } from '@/lib/supabase/types';

interface OpponentBoardProps {
  opponentName: string;
  opponentRole: 'host' | 'guest';
  isReady: boolean;
  wordLength: number;
  maxAttempts: number;
  guesses: LobbyGuess[];
  isMatchFinished: boolean;
}

export const OpponentBoard: React.FC<OpponentBoardProps> = ({
  opponentName,
  isReady,
  wordLength,
  maxAttempts,
  guesses,
  isMatchFinished,
}) => {
  const emptiesCount = Math.max(0, maxAttempts - guesses.length);

  const getTileColor = (state: string) => {
    switch (state) {
      case 'correct':
        return 'bg-emerald-600 border-emerald-500 text-white';
      case 'present':
        return 'bg-amber-600 border-amber-500 text-white';
      case 'absent':
        return 'bg-zinc-800 border-zinc-700 text-zinc-500';
      default:
        return 'bg-zinc-900 border-zinc-800 text-transparent';
    }
  };

  const hasWon = guesses.some((g) => g.is_correct);

  return (
    <div className="flex flex-col items-center bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between w-full mb-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Opponent</div>
            <div className="text-sm font-bold text-slate-200 truncate max-w-[120px]">
              {opponentName || 'Waiting...'}
            </div>
          </div>
        </div>

        <div>
          {hasWon ? (
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" /> Solved
            </span>
          ) : isReady ? (
            <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Swords className="w-3 h-3" /> Guess {guesses.length}/{maxAttempts}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
              Not Ready
            </span>
          )}
        </div>
      </div>

      {/* Mini Opponent Board */}
      <div className="flex flex-col gap-1.5 my-1">
        {guesses.map((g, rowIdx) => (
          <div key={rowIdx} className="flex gap-1 justify-center">
            {Array.from({ length: wordLength }).map((_, colIdx) => {
              const state = (g.tile_states as string[])?.[colIdx] || 'absent';
              const letter = isMatchFinished ? g.guess_word?.[colIdx] || '' : '';
              return (
                <div
                  key={colIdx}
                  className={`
                    w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center font-bold text-xs uppercase border
                    ${getTileColor(state)}
                  `}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        ))}

        {Array.from({ length: emptiesCount }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-1 justify-center">
            {Array.from({ length: wordLength }).map((_, colIdx) => (
              <div
                key={colIdx}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded border border-zinc-800/80 bg-zinc-950/40 text-transparent"
              >
                -
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="text-[11px] text-slate-500 mt-2 text-center">
        {isMatchFinished ? 'Opponent final solution' : 'Live progress (hidden until match ends)'}
      </div>
    </div>
  );
};
