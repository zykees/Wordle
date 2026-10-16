'use client';

import React from 'react';
import { EvaluatedRow, TileState } from '@/lib/game/engine';

interface BoardProps {
  wordLength: number;
  maxAttempts: number;
  guesses: EvaluatedRow[];
  currentGuess: string;
  isShaking?: boolean;
}

export const Board: React.FC<BoardProps> = ({
  wordLength,
  maxAttempts,
  guesses,
  currentGuess,
  isShaking = false,
}) => {
  const emptiesCount = Math.max(0, maxAttempts - guesses.length - 1);

  // Compute tile sizing classes based on word length to prevent mobile overflow
  const getTileSizeClass = (len: number) => {
    if (len <= 5) return 'w-12 h-12 sm:w-14 sm:h-14 text-xl sm:text-2xl';
    if (len <= 7) return 'w-9 h-9 sm:w-12 sm:h-12 text-base sm:text-xl';
    return 'w-7 h-7 sm:w-10 sm:h-10 text-xs sm:text-base';
  };

  const tileSize = getTileSizeClass(wordLength);

  const getTileColors = (state?: TileState) => {
    switch (state) {
      case 'correct':
        return 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-950/40';
      case 'present':
        return 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-950/40';
      case 'absent':
        return 'bg-zinc-800 border-zinc-700 text-zinc-400';
      default:
        return 'border-zinc-700/70 bg-zinc-900/60 text-slate-100';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 sm:gap-2 my-2 sm:my-4 select-none">
      {/* 1. Completed rows */}
      {guesses.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-1.5 sm:gap-2">
          {row.word.split('').map((char, colIdx) => (
            <div
              key={colIdx}
              style={{ animationDelay: `${colIdx * 100}ms` }}
              className={`
                ${tileSize} flex items-center justify-center font-black uppercase rounded-lg border-2
                animate-flip transition-all duration-300
                ${getTileColors(row.states[colIdx])}
              `}
            >
              {char}
            </div>
          ))}
        </div>
      ))}

      {/* 2. Current active typing row (if game not exceeded max attempts) */}
      {guesses.length < maxAttempts && (
        <div className={`flex gap-1.5 sm:gap-2 ${isShaking ? 'animate-shake' : ''}`}>
          {Array.from({ length: wordLength }).map((_, colIdx) => {
            const char = currentGuess[colIdx] || '';
            const isFilled = Boolean(char);
            return (
              <div
                key={colIdx}
                className={`
                  ${tileSize} flex items-center justify-center font-black uppercase rounded-lg border-2
                  transition-all duration-150
                  ${isFilled
                    ? 'border-emerald-500/80 bg-zinc-900/90 text-white animate-pop shadow-md shadow-emerald-500/10'
                    : 'border-zinc-800 bg-zinc-950/40 text-transparent'}
                `}
              >
                {char}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Empty remaining rows */}
      {Array.from({ length: emptiesCount }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-1.5 sm:gap-2">
          {Array.from({ length: wordLength }).map((_, colIdx) => (
            <div
              key={colIdx}
              className={`
                ${tileSize} flex items-center justify-center font-black uppercase rounded-lg border-2
                border-zinc-800/80 bg-zinc-950/20 text-transparent
              `}
            >
              -
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
