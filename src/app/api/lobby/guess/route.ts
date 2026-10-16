import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { memoryStore } from '@/lib/memoryStore';
import { evaluateGuess } from '@/lib/game/engine';
import { isValidWord } from '@/lib/words/words';
import { LobbyGuess } from '@/lib/supabase/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, role, playerId, playerName, guess } = body;

    const cleanCode = code?.toUpperCase().trim();
    const cleanGuess = guess?.toUpperCase().trim();

    if (!cleanCode || !role || !cleanGuess) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    let lobby = null;
    let existingGuesses: LobbyGuess[] = [];

    if (supabase) {
      const { data, error } = await supabase
        .from('lobbies')
        .select('*')
        .eq('code', cleanCode)
        .single();
      if (!error && data) {
        lobby = data;
        const { data: gList } = await supabase
          .from('lobby_guesses')
          .select('*')
          .eq('lobby_id', lobby.id);
        existingGuesses = gList || [];
      }
    }

    if (!lobby) {
      lobby = memoryStore.getLobbyByCode(cleanCode);
      if (lobby) {
        existingGuesses = memoryStore.getGuesses(lobby.id);
      }
    }

    if (!lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    if (lobby.status === 'finished') {
      return NextResponse.json({
        error: 'Game is already finished',
        targetWord: lobby.target_word,
        winnerRole: lobby.winner_role
      }, { status: 400 });
    }

    if (cleanGuess.length !== lobby.word_length) {
      return NextResponse.json({ error: `Word must be ${lobby.word_length} letters` }, { status: 400 });
    }

    if (!isValidWord(cleanGuess, lobby.word_length)) {
      return NextResponse.json({ error: 'Not in word list' }, { status: 400 });
    }

    // Evaluate tile states
    const tileStates = evaluateGuess(lobby.target_word, cleanGuess);
    const isCorrect = tileStates.every(s => s === 'correct');

    const playerGuesses = existingGuesses.filter(g => g.player_role === role);
    const guessNumber = playerGuesses.length + 1;

    // Check game finish conditions
    let lobbyFinished = false;
    let winnerRole: 'host' | 'guest' | 'draw' | null = null;
    let winnerName: string | null = null;

    if (isCorrect) {
      lobbyFinished = true;
      winnerRole = role;
      winnerName = playerName;
    } else if (guessNumber >= lobby.max_attempts) {
      // Current player exhausted attempts. Check if opponent also exhausted attempts or finished.
      const opponentRole = role === 'host' ? 'guest' : 'host';
      const opponentGuesses = existingGuesses.filter(g => g.player_role === opponentRole);
      const opponentFinished = opponentGuesses.some(g => g.is_correct) || opponentGuesses.length >= lobby.max_attempts;

      if (opponentFinished) {
        lobbyFinished = true;
        const oppWon = opponentGuesses.some(g => g.is_correct);
        if (oppWon) {
          winnerRole = opponentRole;
          winnerName = opponentRole === 'host' ? lobby.host_name : lobby.guest_name;
        } else {
          winnerRole = 'draw';
          winnerName = 'Tie';
        }
      }
    }

    // Persist guess
    const newGuess: LobbyGuess = {
      id: crypto.randomUUID(),
      lobby_id: lobby.id,
      player_role: role,
      player_id: playerId || null,
      player_name: playerName,
      guess_word: cleanGuess,
      guess_number: guessNumber,
      tile_states: tileStates,
      is_correct: isCorrect,
      created_at: new Date().toISOString(),
    };

    if (supabase) {
      await supabase.from('lobby_guesses').insert(newGuess);

      if (lobbyFinished) {
        await supabase
          .from('lobbies')
          .update({
            status: 'finished',
            winner_role: winnerRole,
            winner_name: winnerName,
            updated_at: new Date().toISOString()
          })
          .eq('id', lobby.id);

        // Record persistent stats ONLY IF both players are authenticated members (Guest exemption)
        if (lobby.host_id && lobby.guest_id) {
          const winnerUserId = winnerRole === 'host' ? lobby.host_id : (winnerRole === 'guest' ? lobby.guest_id : null);
          const p1Attempts = role === 'host' ? guessNumber : (existingGuesses.filter(g => g.player_role === 'host').length);
          const p2Attempts = role === 'guest' ? guessNumber : (existingGuesses.filter(g => g.player_role === 'guest').length);

          try {
            await supabase.rpc('record_match_result', {
              p_player1: lobby.host_id,
              p_player2: lobby.guest_id,
              p_winner: winnerUserId,
              p_word_length: lobby.word_length,
              p_p1_attempts: p1Attempts,
              p_p2_attempts: p2Attempts,
              p_target_word: lobby.target_word
            });
          } catch (rpcErr) {
            console.error('Failed to record H2H RPC:', rpcErr);
          }
        }
      }
    }

    // In memory store update
    memoryStore.addGuess(newGuess);
    if (lobbyFinished) {
      lobby.status = 'finished';
      lobby.winner_role = winnerRole;
      lobby.winner_name = winnerName;
      lobby.updated_at = new Date().toISOString();
      memoryStore.saveLobby(lobby);

      // Memory H2H record if both are non-null
      if (lobby.host_id && lobby.guest_id) {
        const winnerUserId = winnerRole === 'host' ? lobby.host_id : (winnerRole === 'guest' ? lobby.guest_id : null);
        memoryStore.recordH2H(lobby.host_id, lobby.guest_id, lobby.word_length, winnerUserId);
      }
    }

    return NextResponse.json({
      success: true,
      tileStates,
      isCorrect,
      lobbyFinished,
      winnerRole,
      winnerName,
      targetWord: lobbyFinished ? lobby.target_word : null,
    });
  } catch (error) {
    console.error('Error handling guess:', error);
    return NextResponse.json({ error: 'Failed to process guess' }, { status: 500 });
  }
}
