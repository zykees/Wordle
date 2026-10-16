import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { memoryStore } from '@/lib/memoryStore';
import { HeadToHeadStats } from '@/lib/supabase/types';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const player1 = searchParams.get('player1');
    const player2 = searchParams.get('player2');

    if (!player1 || !player2) {
      return NextResponse.json({ error: 'Both player IDs required' }, { status: 400 });
    }

    const [first, second] = player1 < player2 ? [player1, player2] : [player2, player1];
    const supabase = getSupabaseServerClient();
    let stats: HeadToHeadStats[] = [];

    if (supabase) {
      const { data, error } = await supabase
        .from('head_to_head_stats')
        .select('*')
        .eq('player_a', first)
        .eq('player_b', second);

      if (!error && data) {
        stats = data;
      }
    }

    if (stats.length === 0) {
      stats = memoryStore.getH2H(first, second);
    }

    // Build breakdown for lengths 4 through 10
    const breakdown: Record<number, { p1Wins: number; p2Wins: number; draws: number; total: number }> = {};
    for (let len = 4; len <= 10; len++) {
      breakdown[len] = { p1Wins: 0, p2Wins: 0, draws: 0, total: 0 };
    }

    let totalP1Wins = 0;
    let totalP2Wins = 0;
    let totalDraws = 0;
    let totalMatches = 0;

    for (const item of stats) {
      const p1Won = player1 === first ? item.player_a_wins : item.player_b_wins;
      const p2Won = player1 === first ? item.player_b_wins : item.player_a_wins;

      if (breakdown[item.word_length]) {
        breakdown[item.word_length].p1Wins = p1Won;
        breakdown[item.word_length].p2Wins = p2Won;
        breakdown[item.word_length].draws = item.draws;
        breakdown[item.word_length].total = item.total_matches;
      }

      totalP1Wins += p1Won;
      totalP2Wins += p2Won;
      totalDraws += item.draws;
      totalMatches += item.total_matches;
    }

    return NextResponse.json({
      player1,
      player2,
      totalP1Wins,
      totalP2Wins,
      totalDraws,
      totalMatches,
      breakdown,
    });
  } catch (error) {
    console.error('Error fetching H2H stats:', error);
    return NextResponse.json({ error: 'Failed to fetch H2H stats' }, { status: 500 });
  }
}
