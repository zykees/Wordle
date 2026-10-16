'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { Board } from '@/components/Board';
import { Keyboard } from '@/components/Keyboard';
import { OpponentBoard } from '@/components/OpponentBoard';
import { LobbyModal } from '@/components/LobbyModal';
import { H2HModal } from '@/components/H2HModal';
import { GameOverModal } from '@/components/GameOverModal';
import { useAuth } from '@/context/AuthContext';
import { evaluateGuess, getKeyStates, soundManager, EvaluatedRow, TileState } from '@/lib/game/engine';
import { getRandomWord, isValidWord } from '@/lib/words/words';
import { Lobby, LobbyGuess } from '@/lib/supabase/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Copy, Check, Play, RefreshCw, AlertCircle } from 'lucide-react';

export default function WordlePage() {
  const { user } = useAuth();

  // Mode and Configuration
  const [mode, setMode] = useState<'solo' | 'multiplayer'>('solo');
  const [wordLength, setWordLength] = useState<number>(5);
  const [maxAttempts, setMaxAttempts] = useState<number>(6);

  // Wordle Play State
  const [targetWord, setTargetWord] = useState<string>('');
  const [currentGuess, setCurrentGuess] = useState<string>('');
  const [guesses, setGuesses] = useState<EvaluatedRow[]>([]);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isWinner, setIsWinner] = useState<boolean>(false);
  const [isDraw, setIsDraw] = useState<boolean>(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Multiplayer Lobby State
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [playerRole, setPlayerRole] = useState<'host' | 'guest'>('host');
  const [opponentGuesses, setOpponentGuesses] = useState<LobbyGuess[]>([]);
  const [codeCopied, setCodeCopied] = useState<boolean>(false);

  // Modals
  const [isLobbyModalOpen, setIsLobbyModalOpen] = useState<boolean>(false);
  const [isH2HModalOpen, setIsH2HModalOpen] = useState<boolean>(false);
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState<boolean>(false);

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentRoundRef = useRef<number>(1);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const showToast = useCallback((msg: string, duration = 1800) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, duration);
  }, []);

  // Initialize or Reset Solo Game
  const startNewSoloGame = useCallback((len = wordLength, att = maxAttempts) => {
    const newWord = getRandomWord(len);
    setTargetWord(newWord);
    setCurrentGuess('');
    setGuesses([]);
    setIsGameOver(false);
    setIsWinner(false);
    setIsDraw(false);
    setWinnerName(null);
    setIsGameOverModalOpen(false);
  }, [wordLength, maxAttempts]);

  // Initial Solo Game setup
  useEffect(() => {
    if (mode === 'solo' && !targetWord) {
      startNewSoloGame(wordLength, maxAttempts);
    }
  }, [mode, wordLength, maxAttempts, targetWord, startNewSoloGame]);

  // URL Invite Code auto-detection: check if ?room=CODE
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const roomCode = urlParams.get('room');
      if (roomCode) {
        setIsLobbyModalOpen(true);
      }
    }
  }, []);

  // Handle Solo Guess Submit
  const handleSoloSubmit = () => {
    if (currentGuess.length !== wordLength) {
      soundManager.playShake();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      showToast(`Word must be ${wordLength} letters`);
      return;
    }

    if (!isValidWord(currentGuess, wordLength)) {
      soundManager.playShake();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      showToast('Not in word list');
      return;
    }

    // Play tile flip audio effects
    for (let i = 0; i < wordLength; i++) {
      setTimeout(() => soundManager.playFlip(i), i * 100);
    }

    const states = evaluateGuess(targetWord, currentGuess);
    const newGuesses = [...guesses, { word: currentGuess, states }];
    setGuesses(newGuesses);
    setCurrentGuess('');

    const won = states.every((s) => s === 'correct');
    if (won) {
      setIsGameOver(true);
      setIsWinner(true);
      setIsGameOverModalOpen(true);
    } else if (newGuesses.length >= maxAttempts) {
      setIsGameOver(true);
      setIsWinner(false);
      setIsGameOverModalOpen(true);
    }
  };

  // Handle Multiplayer Guess Submit
  const handleMultiplayerSubmit = async () => {
    if (!lobby) return;

    if (currentGuess.length !== lobby.word_length) {
      soundManager.playShake();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      showToast(`Word must be ${lobby.word_length} letters`);
      return;
    }

    if (!isValidWord(currentGuess, lobby.word_length)) {
      soundManager.playShake();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      showToast('Not in word list');
      return;
    }

    const guessToSubmit = currentGuess;
    setCurrentGuess('');

    try {
      const res = await fetch('/api/lobby/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: lobby.code,
          role: playerRole,
          playerId: user.isGuest ? null : user.id,
          playerName: user.name,
          guess: guessToSubmit,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to submit guess');
        setCurrentGuess(guessToSubmit);
        return;
      }

      // Broadcast move instantly via Realtime websocket if active
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.send({
          type: 'broadcast',
          event: 'guess_made',
          payload: { role: playerRole, count: guesses.length + 1 },
        });
      }

      // Flip sounds
      for (let i = 0; i < lobby.word_length; i++) {
        setTimeout(() => soundManager.playFlip(i), i * 100);
      }

      const states = data.tileStates;
      const newGuesses = [...guesses, { word: guessToSubmit, states }];
      setGuesses(newGuesses);

      if (data.lobbyFinished) {
        setIsGameOver(true);
        if (data.winnerRole === playerRole) {
          setIsWinner(true);
          setIsDraw(false);
        } else if (data.winnerRole === 'draw') {
          setIsWinner(false);
          setIsDraw(true);
        } else {
          setIsWinner(false);
          setIsDraw(false);
        }
        setWinnerName(data.winnerName);
        if (data.targetWord) setTargetWord(data.targetWord);
        setIsGameOverModalOpen(true);
      }
    } catch {
      showToast('Connection error');
      setCurrentGuess(guessToSubmit);
    }
  };

  const handleEnter = () => {
    if (isGameOver) return;
    if (mode === 'solo') {
      handleSoloSubmit();
    } else {
      handleMultiplayerSubmit();
    }
  };

  const handleDelete = () => {
    if (isGameOver) return;
    setCurrentGuess((prev) => prev.slice(0, -1));
  };

  const handleChar = (char: string) => {
    if (isGameOver) return;
    const len = mode === 'solo' ? wordLength : lobby?.word_length || wordLength;
    if (currentGuess.length < len) {
      setCurrentGuess((prev) => prev + char);
    }
  };

  // Keyboard Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLobbyModalOpen || isH2HModalOpen) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleEnter();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        soundManager.playKey();
        handleDelete();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        soundManager.playKey();
        handleChar(e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Multiplayer Room State Sync & Fast Realtime Polling
  useEffect(() => {
    if (mode !== 'multiplayer' || !lobby) return;

    let isSubscribed = true;

    // Fast polling function for state sync (600ms)
    const fetchLobbyUpdate = async () => {
      try {
        const res = await fetch(`/api/lobby/${lobby.code}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!isSubscribed) return;

        if (data.lobby) {
          // Check if round number changed (Rematch triggered!)
          if (data.lobby.round_number !== currentRoundRef.current) {
            currentRoundRef.current = data.lobby.round_number;
            setLobby(data.lobby);
            setGuesses([]);
            setCurrentGuess('');
            setOpponentGuesses([]);
            setIsGameOver(false);
            setIsWinner(false);
            setIsDraw(false);
            setWinnerName(null);
            setIsGameOverModalOpen(false);
            setTargetWord(data.lobby.target_word);
            showToast(`Round ${data.lobby.round_number} Started!`);
            return;
          }

          // If rematch set status back to in_progress while local is marked finished
          if (data.lobby.status === 'in_progress' && isGameOver) {
            setLobby(data.lobby);
            setGuesses([]);
            setCurrentGuess('');
            setOpponentGuesses([]);
            setIsGameOver(false);
            setIsWinner(false);
            setIsDraw(false);
            setWinnerName(null);
            setIsGameOverModalOpen(false);
          } else {
            setLobby(data.lobby);
          }

          if (data.lobby.status === 'finished') {
            setIsGameOver(true);
            if (data.lobby.winner_role === playerRole) {
              setIsWinner(true);
              setIsDraw(false);
            } else if (data.lobby.winner_role === 'draw') {
              setIsWinner(false);
              setIsDraw(true);
            } else {
              setIsWinner(false);
              setIsDraw(false);
            }
            setWinnerName(data.lobby.winner_name);
            setTargetWord(data.lobby.target_word);
          }
        }

        if (data.guesses) {
          const opponentRole = playerRole === 'host' ? 'guest' : 'host';
          const oppList = (data.guesses as LobbyGuess[]).filter((g) => g.player_role === opponentRole);
          setOpponentGuesses(oppList);

          // If local guesses is empty and remote has guesses (e.g. reload), restore them
          const myGuesses = (data.guesses as LobbyGuess[]).filter((g) => g.player_role === playerRole);
          if (myGuesses.length > 0 && guesses.length === 0 && !isGameOver) {
            setGuesses(
              myGuesses.map((g) => ({
                word: g.guess_word,
                states: g.tile_states as TileState[],
              }))
            );
          }
        }
      } catch (err) {
        console.error('Lobby poll error:', err);
      }
    };

    // Immediate initial sync
    fetchLobbyUpdate();

    // 600ms fast polling for snappy real-time experience
    const intervalId = setInterval(fetchLobbyUpdate, 600);

    // Supabase Realtime channel subscription if configured
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel(`lobby_${lobby.id}`, {
          config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'guess_made' }, () => {
          fetchLobbyUpdate();
        })
        .on('broadcast', { event: 'rematch_started' }, () => {
          fetchLobbyUpdate();
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'lobbies', filter: `id=eq.${lobby.id}` },
          () => {
            fetchLobbyUpdate();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'lobby_guesses', filter: `lobby_id=eq.${lobby.id}` },
          () => {
            fetchLobbyUpdate();
          }
        )
        .subscribe();

      realtimeChannelRef.current = channel;
    }

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
      if (channel && supabase) {
        supabase.removeChannel(channel);
        realtimeChannelRef.current = null;
      }
    };
  }, [mode, lobby?.id, lobby?.code, playerRole, guesses.length, isGameOver, showToast]);

  // Handle Rematch in Multiplayer
  const handleRematch = async () => {
    if (!lobby) {
      startNewSoloGame();
      return;
    }

    try {
      const res = await fetch('/api/lobby/rematch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: lobby.code }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Send instant broadcast to opponent
        if (realtimeChannelRef.current) {
          realtimeChannelRef.current.send({
            type: 'broadcast',
            event: 'rematch_started',
            payload: { round: data.lobby.round_number },
          });
        }

        currentRoundRef.current = data.lobby.round_number;
        setLobby(data.lobby);
        setGuesses([]);
        setCurrentGuess('');
        setOpponentGuesses([]);
        setIsGameOver(false);
        setIsWinner(false);
        setIsDraw(false);
        setWinnerName(null);
        setIsGameOverModalOpen(false);
        setTargetWord(data.lobby.target_word);
        showToast(`Round ${data.lobby.round_number} Started!`);
      }
    } catch {
      showToast('Failed to start rematch');
    }
  };

  // Switch Word Length in Solo mode
  const handleSelectWordLength = (len: number) => {
    setWordLength(len);
    startNewSoloGame(len, maxAttempts);
  };

  // Switch Max Attempts in Solo mode
  const handleSelectMaxAttempts = (att: number) => {
    setMaxAttempts(att);
    startNewSoloGame(wordLength, att);
  };

  const handleLobbyJoined = (joinedLobby: Lobby, role: 'host' | 'guest') => {
    setMode('multiplayer');
    setLobby(joinedLobby);
    setPlayerRole(role);
    currentRoundRef.current = joinedLobby.round_number || 1;
    setWordLength(joinedLobby.word_length);
    setMaxAttempts(joinedLobby.max_attempts);
    setGuesses([]);
    setCurrentGuess('');
    setOpponentGuesses([]);
    setIsGameOver(false);
    setIsWinner(false);
    setIsDraw(false);
    setWinnerName(null);
    setIsGameOverModalOpen(false);
  };

  const handleSwitchToSolo = () => {
    setMode('solo');
    setLobby(null);
    startNewSoloGame(wordLength, maxAttempts);
  };

  const copyRoomCode = () => {
    if (!lobby) return;
    navigator.clipboard.writeText(lobby.code);
    setCodeCopied(true);
    showToast(`Room code ${lobby.code} copied!`);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const keyStates = getKeyStates(guesses);

  const opponentName = playerRole === 'host' ? lobby?.guest_name : lobby?.host_name;
  const opponentId = playerRole === 'host' ? lobby?.guest_id : lobby?.host_id;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white font-bold text-xs sm:text-sm py-2 px-4 rounded-xl shadow-2xl border border-slate-700 animate-pop">
          {toast}
        </div>
      )}

      {/* Header */}
      <Header
        mode={mode}
        wordLength={mode === 'solo' ? wordLength : lobby?.word_length || wordLength}
        maxAttempts={mode === 'solo' ? maxAttempts : lobby?.max_attempts || maxAttempts}
        onSelectWordLength={handleSelectWordLength}
        onSelectMaxAttempts={handleSelectMaxAttempts}
        onOpenLobbyModal={() => setIsLobbyModalOpen(true)}
        onOpenH2HModal={() => setIsH2HModalOpen(true)}
        onSwitchToSolo={handleSwitchToSolo}
      />

      {/* Main Game Stage */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 max-w-5xl mx-auto w-full">
        {mode === 'multiplayer' && lobby && (
          /* Multiplayer Lobby Status Banner */
          <div className="w-full max-w-xl mb-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold uppercase">Room:</span>
              <span className="font-mono font-bold text-indigo-400 text-sm">{lobby.code}</span>
              <button
                onClick={copyRoomCode}
                className="p-1 hover:text-white text-slate-400 rounded transition"
                title="Copy Room Code"
              >
                {codeCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-semibold">
                Round {lobby.round_number || 1}
              </span>
              <span className="text-slate-600">•</span>
              {lobby.status === 'waiting' ? (
                <span className="text-amber-400 flex items-center gap-1 font-medium animate-pulse">
                  <AlertCircle className="w-3 h-3" /> Waiting for Player 2
                </span>
              ) : lobby.status === 'in_progress' ? (
                <span className="text-emerald-400 flex items-center gap-1 font-bold">
                  <Play className="w-3 h-3" /> Live Duel
                </span>
              ) : (
                <span className="text-indigo-400 font-bold">Match Finished</span>
              )}
            </div>
          </div>
        )}

        {/* Boards Section */}
        <div className="w-full flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-8 my-auto">
          {/* Player Board */}
          <div className="flex flex-col items-center">
            {mode === 'multiplayer' && (
              <div className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Your Board ({user.name})
              </div>
            )}
            <Board
              wordLength={mode === 'solo' ? wordLength : lobby?.word_length || wordLength}
              maxAttempts={mode === 'solo' ? maxAttempts : lobby?.max_attempts || maxAttempts}
              guesses={guesses}
              currentGuess={currentGuess}
              isShaking={isShaking}
            />
          </div>

          {/* Opponent Mini Board (Multiplayer Only) */}
          {mode === 'multiplayer' && lobby && (
            <div className="flex flex-col items-center">
              <OpponentBoard
                opponentName={opponentName || 'Waiting for opponent...'}
                opponentRole={playerRole === 'host' ? 'guest' : 'host'}
                isReady={Boolean(opponentName)}
                wordLength={lobby.word_length}
                maxAttempts={lobby.max_attempts}
                guesses={opponentGuesses}
                isMatchFinished={isGameOver}
              />
            </div>
          )}
        </div>

        {/* In-game action bar */}
        <div className="my-2 flex items-center gap-2">
          {mode === 'solo' ? (
            <button
              onClick={() => startNewSoloGame()}
              className="py-1 px-3 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" /> New Word
            </button>
          ) : (
            isGameOver && (
              <button
                onClick={handleRematch}
                className="py-1.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition flex items-center gap-1.5 animate-bounce"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Next Round / Rematch
              </button>
            )
          )}
        </div>

        {/* Virtual Keyboard */}
        <div className="w-full max-w-xl mt-auto pb-4">
          <Keyboard
            onChar={handleChar}
            onEnter={handleEnter}
            onDelete={handleDelete}
            keyStates={keyStates}
            disabled={isGameOver || (mode === 'multiplayer' && lobby?.status === 'waiting')}
          />
        </div>
      </main>

      {/* Modals */}
      <LobbyModal
        isOpen={isLobbyModalOpen}
        onClose={() => setIsLobbyModalOpen(false)}
        onLobbyJoined={handleLobbyJoined}
      />

      <H2HModal
        isOpen={isH2HModalOpen}
        onClose={() => setIsH2HModalOpen(false)}
        opponentId={opponentId}
        opponentName={opponentName || 'Opponent'}
      />

      <GameOverModal
        isOpen={isGameOverModalOpen}
        onClose={() => setIsGameOverModalOpen(false)}
        targetWord={targetWord}
        isWinner={isWinner}
        isDraw={isDraw}
        winnerName={winnerName}
        attemptsCount={guesses.length}
        maxAttempts={mode === 'solo' ? maxAttempts : lobby?.max_attempts || maxAttempts}
        isMultiplayer={mode === 'multiplayer'}
        onRematch={mode === 'multiplayer' ? handleRematch : () => startNewSoloGame()}
        onOpenH2H={() => setIsH2HModalOpen(true)}
        canViewH2H={mode === 'multiplayer' && Boolean(opponentId)}
      />
    </div>
  );
}
