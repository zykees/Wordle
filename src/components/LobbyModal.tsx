'use client';

import React, { useState } from 'react';
import { X, PlusCircle, LogIn, Copy, Check, Users, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Lobby } from '@/lib/supabase/types';

interface LobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLobbyJoined: (lobby: Lobby, role: 'host' | 'guest') => void;
}

export const LobbyModal: React.FC<LobbyModalProps> = ({
  isOpen,
  onClose,
  onLobbyJoined,
}) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [wordLength, setWordLength] = useState<number>(5);
  const [maxAttempts, setMaxAttempts] = useState<number>(6);
  const [joinCode, setJoinCode] = useState('');
  const [createdLobby, setCreatedLobby] = useState<Lobby | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleCreate = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/lobby/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordLength,
          maxAttempts,
          hostId: user.isGuest ? null : user.id,
          hostName: user.name,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create lobby');
      }
      setCreatedLobby(data.lobby);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating room';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      setErrorMsg('Please enter a room code');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/lobby/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: joinCode.trim(),
          guestId: user.isGuest ? null : user.id,
          guestName: user.name,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to join lobby');
      }
      onLobbyJoined(data.lobby, 'guest');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error joining room';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (!createdLobby) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}?room=${createdLobby.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const enterCreatedRoom = () => {
    if (createdLobby) {
      onLobbyJoined(createdLobby, 'host');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Multiplayer Duel</h2>
              <p className="text-xs text-slate-400">Wordle battle with invite codes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1">
          <button
            onClick={() => { setTab('create'); setCreatedLobby(null); setErrorMsg(''); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              tab === 'create'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4" /> Create Room
          </button>
          <button
            onClick={() => { setTab('join'); setCreatedLobby(null); setErrorMsg(''); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              tab === 'join'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-4 h-4" /> Join Room
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {tab === 'create' ? (
            createdLobby ? (
              /* Room created view */
              <div className="text-center space-y-4 py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Lobby Ready!</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Share this room code with your friend to start duel
                  </p>
                </div>

                <div className="bg-slate-950 border border-indigo-500/30 rounded-2xl p-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Room Code</div>
                  <div className="text-3xl font-black text-indigo-400 tracking-widest font-mono select-all">
                    {createdLobby.code}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    {createdLobby.word_length} Letters • {createdLobby.max_attempts} Guesses
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={copyInviteLink}
                    className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-slate-200 text-xs flex items-center justify-center gap-2 transition"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Link Copied!' : 'Copy Invite Link'}
                  </button>
                  <button
                    onClick={enterCreatedRoom}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs transition"
                  >
                    Enter Room
                  </button>
                </div>
              </div>
            ) : (
              /* Create settings form */
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Word Length (4 to 10 letters)
                  </label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {[4, 5, 6, 7, 8, 9, 10].map((len) => (
                      <button
                        key={len}
                        type="button"
                        onClick={() => setWordLength(len)}
                        className={`py-2 rounded-lg text-xs font-bold border transition ${
                          wordLength === len
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {len}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Max Attempts
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[5, 6, 7].map((att) => (
                      <button
                        key={att}
                        type="button"
                        onClick={() => setMaxAttempts(att)}
                        className={`py-2 rounded-lg text-xs font-bold border transition ${
                          maxAttempts === att
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {att} Guesses
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-400 leading-relaxed">
                  Both players will solve the exact same {wordLength}-letter secret word simultaneously!
                </div>

                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold text-white shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
                >
                  {loading ? 'Generating Room...' : 'Create Room & Get Code'}
                </button>
              </div>
            )
          ) : (
            /* Join room form */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Enter 6-Character Room Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. 7X9K2P"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-xl font-mono font-bold tracking-widest text-indigo-400 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleJoin}
                disabled={loading || joinCode.length < 3}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 font-bold text-white shadow-lg shadow-indigo-900/30 transition disabled:opacity-50"
              >
                {loading ? 'Joining Room...' : 'Join Room'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
