-- ==============================================================================
-- WORDLE DUEL: SUPABASE DATABASE SCHEMA & REALTIME SETUP
-- Supports Word lengths 4 to 10 letters, Head-to-Head Stats, and Guest Exemption
-- ==============================================================================

-- 1. PROFILES (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT NOT NULL DEFAULT 'Wordle Player',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: Automatically create public.profiles when a user signs in via Google OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Wordle Player'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. LOBBIES TABLE
CREATE TABLE IF NOT EXISTS public.lobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  word_length INT NOT NULL DEFAULT 5 CHECK (word_length BETWEEN 4 AND 10),
  max_attempts INT NOT NULL DEFAULT 6,
  target_word TEXT NOT NULL,
  host_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  host_name TEXT NOT NULL DEFAULT 'Host',
  host_ready BOOLEAN NOT NULL DEFAULT FALSE,
  guest_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name TEXT DEFAULT NULL,
  guest_ready BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'finished')),
  winner_role TEXT DEFAULT NULL CHECK (winner_role IN ('host', 'guest', 'draw', NULL)),
  winner_name TEXT DEFAULT NULL,
  round_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lobbies_code ON public.lobbies(code);


-- 3. LOBBY GUESSES (Realtime Game Moves)
CREATE TABLE IF NOT EXISTS public.lobby_guesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  player_role TEXT NOT NULL CHECK (player_role IN ('host', 'guest')),
  player_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  guess_word TEXT NOT NULL,
  guess_number INT NOT NULL,
  tile_states JSONB NOT NULL, -- e.g. ["correct", "present", "absent", ...]
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lobby_guesses_lobby_id ON public.lobby_guesses(lobby_id);


-- 4. MATCH HISTORY (Saved ONLY when both players are authenticated members, guests are excluded)
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  word_length INT NOT NULL CHECK (word_length BETWEEN 4 AND 10),
  player1_attempts INT NOT NULL,
  player2_attempts INT NOT NULL,
  target_word TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_players ON public.matches(player1_id, player2_id);


-- 5. HEAD-TO-HEAD STATS TABLE
-- Records Head-to-Head win/loss/draw counts broken down by word length (4 to 10 letters)
CREATE TABLE IF NOT EXISTS public.head_to_head_stats (
  player_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_length INT NOT NULL CHECK (word_length BETWEEN 4 AND 10),
  player_a_wins INT NOT NULL DEFAULT 0,
  player_b_wins INT NOT NULL DEFAULT 0,
  draws INT NOT NULL DEFAULT 0,
  total_matches INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_canonical_player_order CHECK (player_a < player_b),
  PRIMARY KEY (player_a, player_b, word_length)
);

CREATE INDEX IF NOT EXISTS idx_h2h_lookup ON public.head_to_head_stats(player_a, player_b);


-- 6. RPC FUNCTION: Record Match Result & Increment H2H Stats (Guest exempt!)
CREATE OR REPLACE FUNCTION public.record_match_result(
  p_player1 UUID,
  p_player2 UUID,
  p_winner UUID,
  p_word_length INT,
  p_p1_attempts INT,
  p_p2_attempts INT,
  p_target_word TEXT
)
RETURNS VOID AS $$
DECLARE
  v_first UUID;
  v_second UUID;
  v_first_wins INT := 0;
  v_second_wins INT := 0;
  v_is_draw INT := 0;
BEGIN
  -- Strict Guest Exemption: If either player is a guest (NULL id), DO NOT save to DB
  IF p_player1 IS NULL OR p_player2 IS NULL THEN
    RETURN;
  END IF;

  -- Insert to match history
  INSERT INTO public.matches (
    player1_id, player2_id, winner_id, word_length,
    player1_attempts, player2_attempts, target_word
  ) VALUES (
    p_player1, p_player2, p_winner, p_word_length,
    p_p1_attempts, p_p2_attempts, p_target_word
  );

  -- Canonical player ordering: player_a is always less than player_b (lexicographically)
  IF p_player1 < p_player2 THEN
    v_first := p_player1;
    v_second := p_player2;
    IF p_winner = p_player1 THEN
      v_first_wins := 1;
    ELSIF p_winner = p_player2 THEN
      v_second_wins := 1;
    ELSE
      v_is_draw := 1;
    END IF;
  ELSE
    v_first := p_player2;
    v_second := p_player1;
    IF p_winner = p_player2 THEN
      v_first_wins := 1;
    ELSIF p_winner = p_player1 THEN
      v_second_wins := 1;
    ELSE
      v_is_draw := 1;
    END IF;
  END IF;

  -- Upsert into head_to_head_stats
  INSERT INTO public.head_to_head_stats (
    player_a, player_b, word_length,
    player_a_wins, player_b_wins, draws, total_matches, updated_at
  ) VALUES (
    v_first, v_second, p_word_length,
    v_first_wins, v_second_wins, v_is_draw, 1, NOW()
  )
  ON CONFLICT (player_a, player_b, word_length) DO UPDATE SET
    player_a_wins = public.head_to_head_stats.player_a_wins + EXCLUDED.player_a_wins,
    player_b_wins = public.head_to_head_stats.player_b_wins + EXCLUDED.player_b_wins,
    draws = public.head_to_head_stats.draws + EXCLUDED.draws,
    total_matches = public.head_to_head_stats.total_matches + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. ENABLE ROW LEVEL SECURITY (RLS) & POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobby_guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.head_to_head_stats ENABLE ROW LEVEL SECURITY;

-- Profiles: Public read, User can update own profile
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Lobbies: Accessible to all (Guests & Authenticated users)
CREATE POLICY "Anyone can view lobbies" 
  ON public.lobbies FOR SELECT USING (true);
CREATE POLICY "Anyone can create lobbies" 
  ON public.lobbies FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update lobbies" 
  ON public.lobbies FOR UPDATE USING (true);

-- Lobby Guesses: Accessible to all
CREATE POLICY "Anyone can view lobby guesses" 
  ON public.lobby_guesses FOR SELECT USING (true);
CREATE POLICY "Anyone can insert lobby guesses" 
  ON public.lobby_guesses FOR INSERT WITH CHECK (true);

-- Matches: Authenticated users can view their own matches
CREATE POLICY "Users can view matches they participated in" 
  ON public.matches FOR SELECT 
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Head-to-Head stats: Viewable by participating users
CREATE POLICY "Users can view their H2H stats" 
  ON public.head_to_head_stats FOR SELECT 
  USING (auth.uid() = player_a OR auth.uid() = player_b);


-- 8. SUPABASE REALTIME CONFIGURATION
-- Publish changes so players receive live moves without page refreshes
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE public.lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_guesses;
