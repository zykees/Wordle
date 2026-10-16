'use client';

import React, { useEffect, useState } from 'react';
import { X, Trophy, Swords, ShieldAlert, Award, Hash } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface H2HModalProps {
  isOpen: boolean;
  onClose: () => void;
  opponentId?: string | null;
  opponentName?: string | null;
}

interface H2HData {
  totalP1Wins: number;
  totalP2Wins: number;
  totalDraws: number;
  totalMatches: number;
  breakdown: Record<number, { p1Wins: number; p2Wins: number; draws: number; total: number }>;
}

export const H2HModal: React.FC<H2HModalProps> = ({
  isOpen,
  onClose,
  opponentId,
  opponentName = 'Opponent',
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<H2HData | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (user.isGuest || !opponentId || opponentId.startsWith('guest_')) {
      // Guest mode: not persisted in DB
      return;
    }

    async function fetchStats() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stats/h2h?player1=${user.id}&player2=${opponentId}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Failed to load H2H stats:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [isOpen, opponentId, user.id, user.isGuest]);

  if (!isOpen) return null;

  const isGuestMode = user.isGuest || !opponentId || opponentId.startsWith('guest_');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Head-to-Head Statistics
              </h2>
              <p className="text-xs text-slate-400">
                {user.name} vs {opponentName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isGuestMode ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-4">
              <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-amber-300">Guest Match Policy</div>
                <div className="text-slate-300 mt-1 leading-relaxed">
                  You or your opponent is currently playing as a <strong>Guest</strong>. In accordance with game rules,
                  guest matches are not permanently recorded in the database.
                </div>
                <div className="mt-3 text-xs text-amber-400/90 font-medium">
                  💡 Sign in with Google to enable permanent match history and Head-to-Head tracking across all word lengths!
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
              Loading matchup history...
            </div>
          ) : (
            <>
              {/* Summary Scorecard */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-4 text-center">
                  <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Your Wins</div>
                  <div className="text-3xl font-black text-emerald-400 mt-1">
                    {data?.totalP1Wins || 0}
                  </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 text-center">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Draws</div>
                  <div className="text-3xl font-black text-slate-300 mt-1">
                    {data?.totalDraws || 0}
                  </div>
                </div>
                <div className="bg-rose-950/30 border border-rose-500/20 rounded-2xl p-4 text-center">
                  <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider">{opponentName} Wins</div>
                  <div className="text-3xl font-black text-rose-400 mt-1">
                    {data?.totalP2Wins || 0}
                  </div>
                </div>
              </div>

              {/* Breakdown by Word Length (4 to 10 Letters) */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-emerald-400" />
                  Performance by Word Length (4 – 10 Letters)
                </h3>
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Length</th>
                        <th className="py-3 px-4 text-center">{user.name} Wins</th>
                        <th className="py-3 px-4 text-center">{opponentName} Wins</th>
                        <th className="py-3 px-4 text-center">Draws</th>
                        <th className="py-3 px-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {[4, 5, 6, 7, 8, 9, 10].map((len) => {
                        const row = data?.breakdown?.[len] || { p1Wins: 0, p2Wins: 0, draws: 0, total: 0 };
                        return (
                          <tr key={len} className="hover:bg-slate-900/40 transition">
                            <td className="py-2.5 px-4 font-bold text-slate-200">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                                {len} Letters
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center font-bold text-emerald-400">
                              {row.p1Wins}
                            </td>
                            <td className="py-2.5 px-4 text-center font-bold text-rose-400">
                              {row.p2Wins}
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-400">
                              {row.draws}
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-300 font-semibold">
                              {row.total}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-slate-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
