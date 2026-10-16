'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RefreshCw, ExternalLink, Swords, Frown } from 'lucide-react';
import { soundManager } from '@/lib/game/engine';

interface GameOverModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetWord: string;
  isWinner: boolean;
  isDraw?: boolean;
  winnerName?: string | null;
  attemptsCount: number;
  maxAttempts: number;
  isMultiplayer?: boolean;
  onRematch?: () => void;
  onOpenH2H?: () => void;
  canViewH2H?: boolean;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  onClose,
  targetWord,
  isWinner,
  isDraw = false,
  winnerName,
  attemptsCount,
  maxAttempts,
  isMultiplayer = false,
  onRematch,
  onOpenH2H,
  canViewH2H = false,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    if (isWinner) {
      soundManager.playWin();
      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Safe fallback
      }
    } else if (!isDraw) {
      soundManager.playLose();
    }
  }, [isOpen, isWinner, isDraw]);

  if (!isOpen) return null;

  const definitionUrl = `https://www.google.com/search?q=define+${targetWord.toLowerCase()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-5">
        {/* Banner */}
        <div className="flex justify-center">
          {isWinner ? (
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
              <Trophy className="w-8 h-8" />
            </div>
          ) : isDraw ? (
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Swords className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Frown className="w-8 h-8" />
            </div>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-black text-white">
            {isWinner
              ? isMultiplayer
                ? 'VICTORY!'
                : 'BRILLIANT!'
              : isDraw
              ? "IT'S A DRAW!"
              : isMultiplayer
              ? `${winnerName || 'Opponent'} Won!`
              : 'GAME OVER'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isWinner
              ? `Solved in ${attemptsCount} of ${maxAttempts} attempts`
              : `Better luck in the next round!`}
          </p>
        </div>

        {/* Secret Word Reveal */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Secret Word
          </div>
          <div className="text-2xl font-black text-emerald-400 tracking-wider font-mono">
            {targetWord}
          </div>
          <a
            href={definitionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-2 font-medium"
          >
            Look up definition <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Buttons */}
        <div className="space-y-2 pt-2">
          {onRematch && (
            <button
              onClick={() => {
                onRematch();
                onClose();
              }}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold text-white shadow-lg shadow-emerald-900/30 transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Rematch / Next Round
            </button>
          )}

          {canViewH2H && onOpenH2H && (
            <button
              onClick={() => {
                onClose();
                onOpenH2H();
              }}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-indigo-300 text-xs transition flex items-center justify-center gap-2 border border-slate-700"
            >
              <Swords className="w-4 h-4" /> View Head-to-Head Record
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs text-slate-400 hover:text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
