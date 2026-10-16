import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { memoryStore } from '@/lib/memoryStore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = body.code?.toUpperCase().trim();
    const guestId = body.guestId || null;
    const guestName = body.guestName?.trim() || 'Guest';

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    if (supabase) {
      const { data: lobby, error: fetchErr } = await supabase
        .from('lobbies')
        .select('*')
        .eq('code', code)
        .single();

      if (!fetchErr && lobby) {
        if (lobby.guest_id && lobby.guest_id !== guestId) {
          // If already full
          return NextResponse.json({ error: 'Lobby is already full' }, { status: 400 });
        }

        const { data: updated, error: updateErr } = await supabase
          .from('lobbies')
          .update({
            guest_id: guestId,
            guest_name: guestName,
            guest_ready: true,
            status: lobby.host_ready ? 'in_progress' : 'waiting',
            updated_at: new Date().toISOString()
          })
          .eq('id', lobby.id)
          .select()
          .single();

        if (!updateErr && updated) {
          return NextResponse.json({ success: true, lobby: updated });
        }
      }
    }

    // Fallback store
    const lobby = memoryStore.getLobbyByCode(code);
    if (!lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    if (lobby.guest_name && lobby.guest_name !== guestName && lobby.guest_id && lobby.guest_id !== guestId) {
      return NextResponse.json({ error: 'Lobby is already full' }, { status: 400 });
    }

    lobby.guest_id = guestId;
    lobby.guest_name = guestName;
    lobby.guest_ready = true;
    if (lobby.host_ready) {
      lobby.status = 'in_progress';
    }
    lobby.updated_at = new Date().toISOString();
    memoryStore.saveLobby(lobby);

    return NextResponse.json({ success: true, lobby });
  } catch (error) {
    console.error('Error joining lobby:', error);
    return NextResponse.json({ error: 'Failed to join lobby' }, { status: 500 });
  }
}
