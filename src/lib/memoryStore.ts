import { Lobby, LobbyGuess, HeadToHeadStats } from './supabase/types';

// In-memory fallback cache for development or when Supabase keys are pending
class MemoryStore {
  private lobbies = new Map<string, Lobby>();
  private guesses = new Map<string, LobbyGuess[]>();
  private h2hStats = new Map<string, HeadToHeadStats[]>();

  getLobbyByCode(code: string): Lobby | null {
    return this.lobbies.get(code.toUpperCase()) || null;
  }

  saveLobby(lobby: Lobby): Lobby {
    this.lobbies.set(lobby.code.toUpperCase(), lobby);
    return lobby;
  }

  getGuesses(lobbyId: string): LobbyGuess[] {
    return this.guesses.get(lobbyId) || [];
  }

  addGuess(guess: LobbyGuess): LobbyGuess {
    const list = this.guesses.get(guess.lobby_id) || [];
    list.push(guess);
    this.guesses.set(guess.lobby_id, list);
    return guess;
  }

  recordH2H(playerA: string, playerB: string, wordLength: number, winnerId: string | null) {
    if (!playerA || !playerB) return;
    const [first, second] = playerA < playerB ? [playerA, playerB] : [playerB, playerA];
    const key = `${first}_${second}`;
    const statsList = this.h2hStats.get(key) || [];

    let entry = statsList.find(s => s.word_length === wordLength);
    if (!entry) {
      entry = {
        player_a: first,
        player_b: second,
        word_length: wordLength,
        player_a_wins: 0,
        player_b_wins: 0,
        draws: 0,
        total_matches: 0,
        updated_at: new Date().toISOString()
      };
      statsList.push(entry);
    }

    entry.total_matches++;
    entry.updated_at = new Date().toISOString();

    if (winnerId === first) {
      entry.player_a_wins++;
    } else if (winnerId === second) {
      entry.player_b_wins++;
    } else {
      entry.draws++;
    }

    this.h2hStats.set(key, statsList);
  }

  getH2H(playerA: string, playerB: string): HeadToHeadStats[] {
    const [first, second] = playerA < playerB ? [playerA, playerB] : [playerB, playerA];
    const key = `${first}_${second}`;
    return this.h2hStats.get(key) || [];
  }
}

// Global singleton across hot-reloads
const globalStore = global as unknown as { __wordleMemoryStore?: MemoryStore };
export const memoryStore = globalStore.__wordleMemoryStore || new MemoryStore();
if (process.env.NODE_ENV !== 'production') {
  globalStore.__wordleMemoryStore = memoryStore;
}
