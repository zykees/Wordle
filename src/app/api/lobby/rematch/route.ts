import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { memoryStore } from '@/lib/memoryStore';
import { getRandomWord } from '@/lib/words/words';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = body.code?.toUpperCase().trim();

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    let lobby = null;

    if (supabase) {
      const { data } = await supabase.from('lobbies').select('*').eq('code', code).single();
      lobby = data;
    }

    if (!lobby) {
      lobby = memoryStore.getLobbyByCode(code);
    }

    if (!lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    // Prevent duplicate rematch race condition if both players tap rematch at almost the same instant
    const lastUpdated = lobby.updated_at ? new Date(lobby.updated_at).getTime() : 0;
    const now = Date.now();
    if (lobby.status === 'in_progress' && (now - lastUpdated) < 3000) {
      const sanitized = { ...lobby, target_word: '******' };
      return NextResponse.json({ success: true, lobby: sanitized });
    }

    const newTargetWord = getRandomWord(lobby.word_length);
    const newRound = (Number(lobby.round_number) || 1) + 1;
    const roundStartedAt = new Date().toISOString();

    if (supabase) {
      // Delete old guesses for this lobby
      try {
        await supabase.from('lobby_guesses').delete().eq('lobby_id', lobby.id);
      } catch (delErr) {
        console.warn('Delete lobby_guesses warning:', delErr);
      }

      const { data: updated, error } = await supabase
        .from('lobbies')
        .update({
          target_word: newTargetWord,
          round_number: newRound,
          status: 'in_progress',
          winner_role: null,
          winner_name: null,
          updated_at: roundStartedAt
        })
        .eq('id', lobby.id)
        .select()
        .single();

      if (!error && updated) {
        memoryStore.clearGuesses(lobby.id);
        memoryStore.saveLobby(updated);
        const sanitized = { ...updated, target_word: '******' };
        return NextResponse.json({ success: true, lobby: sanitized });
      }
    }

    // Fallback store
    memoryStore.clearGuesses(lobby.id);
    lobby.target_word = newTargetWord;
    lobby.round_number = newRound;
    lobby.status = 'in_progress';
    lobby.winner_role = null;
    lobby.winner_name = null;
    lobby.updated_at = roundStartedAt;
    memoryStore.saveLobby(lobby);

    const sanitized = { ...lobby, target_word: '******' };
    return NextResponse.json({ success: true, lobby: sanitized });
  } catch (error) {
    console.error('Error starting rematch:', error);
    return NextResponse.json({ error: 'Failed to start rematch' }, { status: 500 });
  }
}
