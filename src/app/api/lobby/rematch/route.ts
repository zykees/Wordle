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

    const newTargetWord = getRandomWord(lobby.word_length);
    const newRound = (lobby.round_number || 1) + 1;

    if (supabase) {
      // Delete old guesses for this lobby
      await supabase.from('lobby_guesses').delete().eq('lobby_id', lobby.id);

      const { data: updated, error } = await supabase
        .from('lobbies')
        .update({
          target_word: newTargetWord,
          round_number: newRound,
          status: 'in_progress',
          winner_role: null,
          winner_name: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', lobby.id)
        .select()
        .single();

      if (!error && updated) {
        return NextResponse.json({ success: true, lobby: updated });
      }
    }

    // Fallback store
    memoryStore.clearGuesses(lobby.id);
    lobby.target_word = newTargetWord;
    lobby.round_number = newRound;
    lobby.status = 'in_progress';
    lobby.winner_role = null;
    lobby.winner_name = null;
    lobby.updated_at = new Date().toISOString();
    memoryStore.saveLobby(lobby);

    return NextResponse.json({ success: true, lobby });
  } catch (error) {
    console.error('Error starting rematch:', error);
    return NextResponse.json({ error: 'Failed to start rematch' }, { status: 500 });
  }
}
