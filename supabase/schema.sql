-- ═══════════════════════════════════════════════════════
-- FRIKINET - SQL SCHEMA
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT CHECK (char_length(bio) <= 200),
  avatar_url TEXT,
  banner_url TEXT,
  color_primary TEXT DEFAULT '#8b5cf6',
  color_secondary TEXT DEFAULT '#6366f1',
  color_accent TEXT DEFAULT '#f59e0b',
  favorite_genres TEXT[] DEFAULT '{}',
  platforms TEXT[] DEFAULT '{}',
  favorite_era TEXT DEFAULT 'current',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Tierlists table
CREATE TABLE tierlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  list_type TEXT NOT NULL DEFAULT 'tierlist',
  media_type TEXT NOT NULL DEFAULT 'game',
  visibility TEXT DEFAULT 'public',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tierlist items
CREATE TABLE tierlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tierlist_id UUID REFERENCES tierlists(id) ON DELETE CASCADE NOT NULL,
  media_id UUID,
  tier TEXT,
  position INTEGER DEFAULT 0,
  personal_note TEXT CHECK (char_length(personal_note) <= 200),
  sentiment_emoji TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_user ON profiles(user_id);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_tierlists_user ON tierlists(user_id);
CREATE INDEX idx_tierlists_visibility ON tierlists(visibility);
CREATE INDEX idx_tierlist_items_tierlist ON tierlist_items(tierlist_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tierlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE tierlist_items ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for tierlists
CREATE POLICY "Public tierlists are viewable by everyone" ON tierlists FOR SELECT USING (visibility = 'public' OR auth.uid() = user_id);
CREATE POLICY "Users can create own tierlists" ON tierlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tierlists" ON tierlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tierlists" ON tierlists FOR DELETE USING (auth.uid() = user_id);

-- Policies for tierlist_items
CREATE POLICY "Tierlist items viewable if tierlist is viewable" ON tierlist_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM tierlists WHERE id = tierlist_id AND (visibility = 'public' OR user_id = auth.uid()))
);
CREATE POLICY "Users can manage items in own tierlists" ON tierlist_items FOR ALL USING (
  EXISTS (SELECT 1 FROM tierlists WHERE id = tierlist_id AND user_id = auth.uid())
);
