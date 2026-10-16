# Wordle Duel (Multiplayer English Wordle 4–10 Letters)

A full-stack, competitive English Wordle web application built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase (PostgreSQL & Realtime)**.

## ✨ Features

- **Classic & Authentic Wordle Mechanics**:
  - Two-pass duplicate letter evaluation (Green for exact match, Yellow for present up to remaining count, Gray for absent).
  - Word length selection: **4, 5, 6, 7, 8, 9, and 10 letters**.
  - Dynamic responsive board and virtual on-screen keyboard.
  - Web Audio API synthesizer for key sounds, flip chimes, win fanfares, and shake buzzes.
- **Multiplayer Lobby & Duel**:
  - Create room with custom word length and max attempts.
  - Unique 6-character room codes (`WD-XXXXXX`) and 1-click invite link copying.
  - Live opponent progress view displaying colored tiles in real time.
  - Rematch button in the same room.
- **Authentication & Guest Exemption**:
  - **Login with Google (OAuth)** for persistent stats.
  - **Play as Guest**: Play freely without an account; guest matches are strictly excluded from database writes.
  - **Head-to-Head (H2H) Statistics**:
    - Tracks total matches, wins, losses, and draws between players.
    - Performance breakdown across every word length (4, 5, 6, 7, 8, 9, 10 letters).

## 🚀 Quick Start (WSL Ubuntu)

```bash
cd /mnt/c/Users/Phong/documents/github/wordle

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

## 🗄️ Database & Supabase Setup

1. Run the SQL schema from [`supabase/schema.sql`](./supabase/schema.sql) in your Supabase SQL Editor.
2. Setup Google OAuth in **Google Cloud Console** and paste credentials into **Supabase Auth > Providers > Google**.
3. Copy `.env.local.example` to `.env.local` and add your Supabase credentials:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

## 📦 Deployment to Vercel

```bash
git add .
git commit -m "feat: complete Wordle Duel"
git push origin main
```
Import into Vercel and add the environment variables.
