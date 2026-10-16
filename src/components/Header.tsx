'use client';

import React, { useState } from 'react';
import { Volume2, VolumeX, Swords, Users, User, LogIn, LogOut, Edit2, Check, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { soundManager } from '@/lib/game/engine';

interface HeaderProps {
  mode: 'solo' | 'multiplayer';
  wordLength: number;
  onSelectWordLength: (length: number) => void;
  onOpenLobbyModal: () => void;
  onOpenH2HModal: () => void;
  onSwitchToSolo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  wordLength,
  onSelectWordLength,
  onOpenLobbyModal,
  onOpenH2HModal,
  onSwitchToSolo,
}) => {
  const { user, loginWithGoogle, logout, updateGuestName } = useAuth();
  const [soundOn, setSoundOn] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user.name);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    soundManager.enabled = next;
  };

  const handleSaveName = () => {
    updateGuestName(editedName);
    setIsEditingName(false);
  };

  return (
    <header className="w-full max-w-4xl mx-auto px-4 py-3 flex flex-col gap-3 select-none border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md sticky top-0 z-40">
      <div className="flex items-center justify-between gap-2">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-base shadow-md shadow-emerald-500/20">
            W
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
              WORDLE <span className="text-emerald-400">DUEL</span>
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            aria-label="Toggle Sound"
            className="p-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 transition"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* H2H Stats */}
          <button
            onClick={onOpenH2HModal}
            aria-label="Head to Head stats"
            className="p-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 transition"
            title="Head-to-Head Stats"
          >
            <Swords className="w-4 h-4 text-indigo-400" />
          </button>

          {/* Mode Switcher */}
          {mode === 'solo' ? (
            <button
              onClick={onOpenLobbyModal}
              className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-900/30 transition"
            >
              <Users className="w-3.5 h-3.5" /> Duel
            </button>
          ) : (
            <button
              onClick={onSwitchToSolo}
              className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition"
            >
              Solo Mode
            </button>
          )}

          {/* Auth Button */}
          {user.isGuest ? (
            <div className="flex items-center gap-1">
              <button
                onClick={loginWithGoogle}
                className="py-1.5 px-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="hidden sm:inline">Sign In</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div
                title={user.name}
                className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-xs text-emerald-400 overflow-hidden"
              >
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              <button
                onClick={logout}
                title="Sign Out"
                className="p-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sub-bar: Word Length selector (4 - 10 letters) & User Tag */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/40 text-xs">
        {mode === 'solo' ? (
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
            <span className="text-slate-500 font-semibold text-[11px] uppercase mr-1">Length:</span>
            {[4, 5, 6, 7, 8, 9, 10].map((len) => (
              <button
                key={len}
                onClick={() => onSelectWordLength(len)}
                className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg font-bold text-xs transition ${
                  wordLength === len
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {len}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Duel Mode • {wordLength} Letters</span>
          </div>
        )}

        {/* Guest edit name inline */}
        {user.isGuest && (
          <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  maxLength={12}
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                />
                <button
                  onClick={handleSaveName}
                  className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="flex items-center gap-1 hover:text-white transition group"
                title="Edit guest display name"
              >
                <User className="w-3 h-3 text-slate-500 group-hover:text-emerald-400" />
                <span className="truncate max-w-[90px] sm:max-w-[120px] font-medium">{user.name}</span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded border border-slate-700">Guest</span>
                <Edit2 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
