'use client';

import React from 'react';
import { Delete, CornerDownLeft } from 'lucide-react';
import { TileState, soundManager } from '@/lib/game/engine';

interface KeyboardProps {
  onChar: (char: string) => void;
  onEnter: () => void;
  onDelete: () => void;
  keyStates: Record<string, TileState>;
  disabled?: boolean;
}

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
];

export const Keyboard: React.FC<KeyboardProps> = ({
  onChar,
  onEnter,
  onDelete,
  keyStates,
  disabled = false,
}) => {
  const getKeyStyle = (key: string) => {
    const state = keyStates[key];
    if (state === 'correct') {
      return 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/50 shadow-emerald-900/30';
    }
    if (state === 'present') {
      return 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500/50 shadow-amber-900/30';
    }
    if (state === 'absent') {
      return 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-500 border-zinc-700/30';
    }
    return 'bg-slate-800/90 hover:bg-slate-700 text-slate-100 border-slate-700/60 hover:border-slate-500';
  };

  const handleKeyClick = (key: string) => {
    if (disabled) return;
    soundManager.playKey();
    if (key === 'ENTER') {
      onEnter();
    } else if (key === 'BACKSPACE') {
      onDelete();
    } else {
      onChar(key);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-1 sm:px-2 select-none">
      {ROWS.map((row, rowIdx) => (
        <div key={rowIdx} className="flex justify-center gap-1 sm:gap-1.5 my-1 sm:my-1.5 touch-manipulation">
          {row.map((key) => {
            const isWide = key === 'ENTER' || key === 'BACKSPACE';
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => handleKeyClick(key)}
                className={`
                  flex items-center justify-center font-bold uppercase rounded-lg border
                  transition-all duration-150 active:scale-95 shadow-sm
                  text-xs sm:text-sm md:text-base
                  h-12 sm:h-14
                  ${isWide ? 'px-2 sm:px-4 flex-[1.4]' : 'flex-1'}
                  ${getKeyStyle(key)}
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {key === 'ENTER' ? (
                  <span className="flex items-center gap-1 text-[11px] sm:text-xs tracking-wider">
                    ENTER <CornerDownLeft className="w-3.5 h-3.5 hidden sm:inline" />
                  </span>
                ) : key === 'BACKSPACE' ? (
                  <Delete className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  key
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};
