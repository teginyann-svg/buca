-- Reservsalon — schéma Postgres (Supabase free)
-- Exécuter dans SQL Editor du projet Supabase.
-- Accès runtime : service_role uniquement (RLS on, aucune policy anon).

create extension if not exists "pgcrypto";

-- ─── Bookings ───────────────────────────────────────────────────────────────

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  client_name text not null,
  client_phone text,
  email text,
  services_label text,
  duration_minutes integer,
  is_new_client boolean not null default false,
  same_device boolean not null default false,
  non_swiss_phone boolean not null default false,
  generated_phone boolean not null default false,
  disposable_email boolean not null default false,
  device_id text,
  summary text not null,
  created_at timestamptz not null default now(),
  google_event_id text
);

create index if not exists bookings_start_at_idx on public.bookings (start_at);

alter table public.bookings enable row level security;

-- ─── Clients ────────────────────────────────────────────────────────────────

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  gender text check (gender is null or gender in ('H', 'F')),
  last_name text not null default '',
  first_name text not null default '',
  birth_day integer,
  birth_month integer,
  birth_year integer,
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  recettes text[] not null default array['']::text[],
  first_visit_at text,
  last_visit_at text,
  is_suspect boolean not null default false,
  suspect_reasons text[] not null default array[]::text[],
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_phone_idx on public.clients (phone);

alter table public.clients enable row level security;

-- ─── Device bookings (anti-abus appareil) ───────────────────────────────────

create table if not exists public.device_bookings (
  device_id text primary key,
  count integer not null default 0,
  bookings jsonb not null default '[]'::jsonb
);

alter table public.device_bookings enable row level security;

-- ─── Calculateur ────────────────────────────────────────────────────────────

create table if not exists public.calculateur_estimates (
  id text primary key,
  minutes integer not null check (minutes > 0)
);

alter table public.calculateur_estimates enable row level security;

create table if not exists public.calculateur_hidden (
  id text primary key
);

alter table public.calculateur_hidden enable row level security;

-- Pas de policy pour anon/authenticated → refus via RLS.
-- Le service_role bypass RLS.
