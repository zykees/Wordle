export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Profile {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lobby {
  id: string;
  code: string;
  word_length: number;
  max_attempts: number;
  target_word: string;
  host_id: string | null;
  host_name: string;
  host_ready: boolean;
  guest_id: string | null;
  guest_name: string | null;
  guest_ready: boolean;
  status: 'waiting' | 'in_progress' | 'finished';
  winner_role: 'host' | 'guest' | 'draw' | null;
  winner_name: string | null;
  round_number: number;
  created_at: string;
  updated_at: string;
}

export interface LobbyGuess {
  id: string;
  lobby_id: string;
  player_role: 'host' | 'guest';
  player_id: string | null;
  player_name: string;
  guess_word: string;
  guess_number: number;
  tile_states: string[]; // ['correct', 'present', 'absent', ...]
  is_correct: boolean;
  created_at: string;
}

export interface MatchHistory {
  id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  word_length: number;
  player1_attempts: number;
  player2_attempts: number;
  target_word: string;
  created_at: string;
}

export interface HeadToHeadStats {
  player_a: string;
  player_b: string;
  word_length: number;
  player_a_wins: number;
  player_b_wins: number;
  draws: number;
  total_matches: number;
  updated_at: string;
}
