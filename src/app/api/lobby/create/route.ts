import { NextResponse } from 'next/server';
import { getRandomWord } from '@/lib/words/words';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { memoryStore } from '@/lib/memoryStore';
import { Lobby } from '@/lib/supabase/types';

function generateLobbyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const wordLength = Math.max(4, Math.min(10, Number(body.wordLength) || 5));
    const maxAttempts = Number(body.maxAttempts) || 6;
    const hostId = body.hostId || null;
    const hostName = body.hostName?.trim() || 'Player 1';

    const code = generateLobbyCode();
    const targetWord = getRandomWord(wordLength);

    const supabase = getSupabaseServerClient();

    if (supabase) {
      const { data, error } = await supabase
        .from('lobbies')
        .insert({
          code,
          word_length: wordLength,
          max_attempts: maxAttempts,
          target_word: targetWord,
          host_id: hostId,
          host_name: hostName,
          host_ready: true,
          status: 'waiting',
        })
        .select()
        .single();

      if (!error && data) {
        return NextResponse.json({ success: true, lobby: data });
      }
      console.warn('Supabase insert failed, using memory store fallback:', error?.message);
    }

    // Fallback store
    const fallbackLobby: Lobby = {
      id: crypto.randomUUID(),
      code,
      word_length: wordLength,
      max_attempts: maxAttempts,
      target_word: targetWord,
      host_id: hostId,
      host_name: hostName,
      host_ready: true,
      guest_id: null,
      guest_name: null,
      guest_ready: false,
      status: 'waiting',
      winner_role: null,
      winner_name: null,
      round_number: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryStore.saveLobby(fallbackLobby);
    return NextResponse.json({ success: true, lobby: fallbackLobby });
  } catch (error) {
    console.error('Error creating lobby:', error);
    return NextResponse.json({ error: 'Failed to create lobby' }, { status: 500 });
  }
}
