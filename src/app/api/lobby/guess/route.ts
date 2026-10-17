import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { memoryStore } from '@/lib/memoryStore';
import { evaluateGuess } from '@/lib/game/engine';
import { isServerValidWord } from '@/lib/words/serverDictionary';
import { isValidWord } from '@/lib/words/words';
import { LobbyGuess } from '@/lib/supabase/types';

function isValidUUID(val: unknown): boolean {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, role, playerId, playerName, guess } = body;

    const cleanCode = code?.toUpperCase().trim();
    const cleanGuess = guess?.toUpperCase().trim();
    const cleanPlayerId = isValidUUID(playerId) ? playerId : null;

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
        .ilike('code', cleanCode)
        .maybeSingle();

      if (!error && data) {
        lobby = data;
        memoryStore.saveLobby(lobby);

        const { data: gList } = await supabase
          .from('lobby_guesses')
          .select('*')
          .eq('lobby_id', lobby.id)
          .order('created_at', { ascending: true });

        const currentRoundNumber = Number(lobby.round_number) || 1;
        const roundStartMs = lobby.updated_at ? new Date(lobby.updated_at).getTime() - 2500 : 0;
        existingGuesses = (gList || []).filter((g: any) => {
          if (typeof g.round_number === 'number' && g.round_number > 0) {
            return g.round_number === currentRoundNumber;
          }
          if (g.created_at && roundStartMs > 0) {
            return new Date(g.created_at).getTime() >= roundStartMs;
          }
          return true;
        });
      }
    }

    if (!lobby) {
      lobby = memoryStore.getLobbyByCode(cleanCode);
      if (lobby) {
        const currentRoundNumber = Number(lobby.round_number) || 1;
        const roundStartMs = lobby.updated_at ? new Date(lobby.updated_at).getTime() - 2500 : 0;
        existingGuesses = memoryStore.getGuesses(lobby.id).filter((g: any) => {
          if (typeof g.round_number === 'number' && g.round_number > 0) {
            return g.round_number === currentRoundNumber;
          }
          if (g.created_at && roundStartMs > 0) {
            return new Date(g.created_at).getTime() >= roundStartMs;
          }
          return true;
        });
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

    if (!isServerValidWord(cleanGuess, lobby.word_length) && !isValidWord(cleanGuess, lobby.word_length)) {
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
      player_id: cleanPlayerId,
      player_name: playerName,
      guess_word: cleanGuess,
      guess_number: guessNumber,
      tile_states: tileStates,
      is_correct: isCorrect,
      created_at: new Date().toISOString(),
    };

    if (supabase) {
      const { error: insErr } = await supabase.from('lobby_guesses').insert({
        ...newGuess,
        round_number: Number(lobby.round_number) || 1
      });

      if (insErr) {
        // If round_number column does not exist yet in DB, fall back to inserting without it
        await supabase.from('lobby_guesses').insert(newGuess);
      }

      if (lobbyFinished) {
        await supabase
          .from('lobbies')
          .update({
            status: 'finished',
            winner_role: winnerRole,
            winner_name: winnerName
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
