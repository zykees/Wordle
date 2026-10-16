'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface UserSession {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  isGuest: boolean;
}

interface AuthContextType {
  user: UserSession;
  isConfigured: boolean;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateGuestName: (name: string) => void;
}

const GUEST_STORAGE_KEY = 'wordle_guest_user';

const defaultGuestUser: UserSession = {
  id: 'guest_user',
  email: null,
  name: 'Guest Player',
  avatarUrl: null,
  isGuest: true,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserSession>(defaultGuestUser);

  // Restore or generate guest identity after client mount (avoids SSR prerender mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GUEST_STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      } else {
        const guestId = 'guest_' + Math.random().toString(36).substring(2, 8);
        const newGuest: UserSession = {
          id: guestId,
          email: null,
          name: 'Guest_' + guestId.slice(-4),
          avatarUrl: null,
          isGuest: true,
        };
        setUser(newGuest);
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(newGuest));
      }
    } catch {
      // Ignore localStorage restrictions
    }
  }, []);

  useEffect(() => {
    // If guest, persist changes
    if (user.isGuest && user.id !== 'guest_user') {
      try {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(user));
      } catch {
        // Ignore
      }
    }
  }, [user]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      return;
    }

    // Check existing Supabase session
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const authUser = session.user;
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

          setUser({
            id: authUser.id,
            email: authUser.email || null,
            name: profile?.display_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Player',
            avatarUrl: profile?.avatar_url || authUser.user_metadata?.avatar_url || null,
            isGuest: false,
          });
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    checkSession();

    // Listen to Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const authUser = session.user;
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        setUser({
          id: authUser.id,
          email: authUser.email || null,
          name: profile?.display_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Player',
          avatarUrl: profile?.avatar_url || authUser.user_metadata?.avatar_url || null,
          isGuest: false,
        });
      } else if (event === 'SIGNED_OUT') {
        const guestId = 'guest_' + Math.random().toString(36).substring(2, 8);
        const guestUser: UserSession = {
          id: guestId,
          email: null,
          name: 'Guest_' + guestId.slice(-4),
          avatarUrl: null,
          isGuest: true,
        };
        setUser(guestUser);
        try {
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestUser));
        } catch {
          // Ignore
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    if (!isSupabaseConfigured || !supabase) {
      alert('Supabase is not configured yet! Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.');
      return;
    }
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) {
      alert('Google login failed: ' + error.message);
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    const guestId = 'guest_' + Math.random().toString(36).substring(2, 8);
    const guestUser: UserSession = {
      id: guestId,
      email: null,
      name: 'Guest_' + guestId.slice(-4),
      avatarUrl: null,
      isGuest: true,
    };
    setUser(guestUser);
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestUser));
    } catch {
      // Ignore
    }
  };

  const updateGuestName = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setUser(prev => {
      const updated = { ...prev, name: clean };
      if (prev.isGuest) {
        try {
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Ignore
        }
      }
      return updated;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isConfigured: isSupabaseConfigured,
        isLoading,
        loginWithGoogle,
        logout,
        updateGuestName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
