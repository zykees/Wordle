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
        .ilike('code', cleanCode)
        .maybeSingle();

      if (!error && lobby) {
        memoryStore.saveLobby(lobby);

        const { data: allGuesses } = await supabase
          .from('lobby_guesses')
          .select('*')
          .eq('lobby_id', lobby.id)
          .order('created_at', { ascending: true });

        // Filter guesses strictly for the current round:
        // 1. By round_number if present
        // 2. Or by creation timestamp against current round start (updated_at)
        const currentRoundNumber = Number(lobby.round_number) || 1;
        const roundStartMs = lobby.updated_at ? new Date(lobby.updated_at).getTime() - 2500 : 0;
        const guesses = (allGuesses || []).filter((g: any) => {
          if (typeof g.round_number === 'number' && g.round_number > 0) {
            return g.round_number === currentRoundNumber;
          }
          if (g.created_at && roundStartMs > 0) {
            return new Date(g.created_at).getTime() >= roundStartMs;
          }
          return true;
        });

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
      if (error) {
        console.warn('Supabase fetch lobby error:', error.message);
      }
    }

    // Fallback store
    const lobby = memoryStore.getLobbyByCode(cleanCode);
    if (!lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    const allMemoryGuesses = memoryStore.getGuesses(lobby.id);
    const currentRoundNumber = Number(lobby.round_number) || 1;
    const roundStartMs = lobby.updated_at ? new Date(lobby.updated_at).getTime() - 2500 : 0;
    const guesses = allMemoryGuesses.filter((g: any) => {
      if (typeof g.round_number === 'number' && g.round_number > 0) {
        return g.round_number === currentRoundNumber;
      }
      if (g.created_at && roundStartMs > 0) {
        return new Date(g.created_at).getTime() >= roundStartMs;
      }
      return true;
    });

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
