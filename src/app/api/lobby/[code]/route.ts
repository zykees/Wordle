import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { memoryStore } from '@/lib/memoryStore';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const cleanCode = code?.toUpperCase().trim();

    if (!cleanCode) {
      return NextResponse.json({ error: 'Lobby code required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    if (supabase) {
      const { data: lobby, error } = await supabase
        .from('lobbies')
        .select('*')
        .eq('code', cleanCode)
        .single();

      if (!error && lobby) {
        const { data: guesses } = await supabase
          .from('lobby_guesses')
          .select('*')
          .eq('lobby_id', lobby.id)
          .order('created_at', { ascending: true });

        // Hide target_word if game is still in progress or waiting
        const sanitizedLobby = {
          ...lobby,
          target_word: lobby.status === 'finished' ? lobby.target_word : '******'
        };

        return NextResponse.json({
          lobby: sanitizedLobby,
          guesses: guesses || [],
        });
      }
    }

    // Fallback store
    const lobby = memoryStore.getLobbyByCode(cleanCode);
    if (!lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    const guesses = memoryStore.getGuesses(lobby.id);
    const sanitizedLobby = {
      ...lobby,
      target_word: lobby.status === 'finished' ? lobby.target_word : '******'
    };

    return NextResponse.json({
      lobby: sanitizedLobby,
      guesses,
    });
  } catch (error) {
    console.error('Error fetching lobby:', error);
    return NextResponse.json({ error: 'Failed to fetch lobby' }, { status: 500 });
  }
}
