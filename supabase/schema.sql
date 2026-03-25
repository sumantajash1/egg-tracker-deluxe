-- EggTracker Deluxe - Supabase Schema
-- Run this in the Supabase SQL Editor to set up the database

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- PROFILES (extends Supabase auth.users - one row per user)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to create profile on signup (for when you add sign up later)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', ''))
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only enable this trigger when you add sign up
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- EGG_TRAY (one active tray at a time - 30 eggs per tray)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.egg_tray (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  eggs_remaining INTEGER NOT NULL DEFAULT 30 CHECK (eggs_remaining >= 0 AND eggs_remaining <= 30)
);

-- RLS
ALTER TABLE public.egg_tray ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read egg trays"
  ON public.egg_tray FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert egg trays"
  ON public.egg_tray FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update egg trays"
  ON public.egg_tray FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- TRAY_CONSUMPTION (tracks how many eggs each user consumed per tray)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tray_consumption (
  tray_id UUID NOT NULL REFERENCES public.egg_tray(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  eggs_consumed INTEGER NOT NULL DEFAULT 0 CHECK (eggs_consumed >= 0),
  PRIMARY KEY (tray_id, user_id)
);

-- RLS
ALTER TABLE public.tray_consumption ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tray consumption"
  ON public.tray_consumption FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tray consumption"
  ON public.tray_consumption FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tray consumption"
  ON public.tray_consumption FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
