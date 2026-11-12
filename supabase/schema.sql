-- =====================================================================
-- Rocket Concursos: esquema inicial (RASCUNHO, ainda não aplicado)
-- Revise antes de rodar no SQL Editor de um projeto Supabase de TESTE.
-- Não foi executado em nenhum banco ao ser escrito.
-- =====================================================================

-- ---------- Perfis (1 por usuário do Supabase Auth) ----------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  public_id     text not null unique check (public_id ~ '^[0-9]{8}$'),
  display_name  text not null check (char_length(display_name) between 1 and 30),
  avatar        text check (avatar is null or char_length(avatar) <= 300000),
  goals_questions int not null default 150 check (goals_questions >= 1),
  goals_sessions  int not null default 15  check (goals_sessions  >= 1),
  created_at    timestamptz not null default now()
);

-- A "public_id" serve para encontrar amigos. NÃO é mecanismo de segurança.
create or replace function public.gerar_public_id() returns text
language plpgsql as $$
declare novo text;
begin
  loop
    novo := lpad((floor(random() * 100000000))::bigint::text, 8, '0');
    exit when not exists (select 1 from public.profiles where public_id = novo);
  end loop;
  return novo;
end $$;

-- Cria o perfil automaticamente quando alguém se cadastra.
create or replace function public.criar_perfil_do_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, public_id, display_name)
  values (
    new.id,
    public.gerar_public_id(),
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Usuário'), 30)
  );
  return new;
end $$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_do_novo_usuario();

-- ---------- Dados de estudo ----------
create table public.records (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  subject    text not null default '' check (char_length(subject) <= 80),
  topic      text not null default '' check (char_length(topic) <= 120),
  source     text not null default '' check (char_length(source) <= 120),
  total      int  not null check (total >= 1),
  correct    int  not null check (correct >= 0),
  difficulty text not null default 'ok' check (difficulty in ('ok', 'medio', 'dificil')),
  error      text not null default '' check (char_length(error) <= 80),
  notes      text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  check (correct <= total)
);

create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  subject    text not null default '' check (char_length(subject) <= 80),
  topic      text not null default '' check (char_length(topic) <= 120),
  type       text not null default '' check (char_length(type) <= 80),
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.mocks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  name       text not null default '' check (char_length(name) <= 120),
  total      int  not null check (total >= 1),
  correct    int  not null check (correct >= 0),
  minutes    int  not null default 0 check (minutes >= 0),
  notes      text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  check (correct <= total)
);

create table public.study_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  minutes    int  not null check (minutes >= 1),
  notes      text not null default '' check (char_length(notes) <= 120),
  created_at timestamptz not null default now()
);

create index on public.records        (user_id, date desc);
create index on public.reviews        (user_id, date);
create index on public.mocks          (user_id, date desc);
create index on public.study_sessions (user_id, date desc);

-- ---------- Amizades ----------
create table public.friendships (
  requester_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- Impede o par repetido em sentidos opostos (A->B e B->A).
create unique index friendships_par_unico
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- security definer evita recursão das políticas ao consultar friendships.
create or replace function public.sao_amigos(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- Busca por ID público: devolve só o mínimo necessário (nunca e-mail).
create or replace function public.buscar_perfil(p_public_id text)
returns table (id uuid, public_id text, display_name text, avatar text)
language sql stable security definer set search_path = public as $$
  select p.id, p.public_id, p.display_name, p.avatar
  from public.profiles p
  where p.public_id = p_public_id and p.id <> auth.uid();
$$;
revoke all on function public.buscar_perfil(text) from public, anon;
grant execute on function public.buscar_perfil(text) to authenticated;

-- ---------- Row Level Security ----------
alter table public.profiles       enable row level security;
alter table public.records        enable row level security;
alter table public.reviews        enable row level security;
alter table public.mocks          enable row level security;
alter table public.study_sessions enable row level security;
alter table public.friendships    enable row level security;

-- Perfis: o próprio e os amigos aceitos podem ser lidos; só o dono altera.
create policy perfis_ler on public.profiles for select to authenticated
  using (id = auth.uid() or public.sao_amigos(id, auth.uid()));
create policy perfis_atualizar on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Dados de estudo: dono faz tudo; amigos aceitos só leem.
do $$
declare t text;
begin
  foreach t in array array['records', 'reviews', 'mocks', 'study_sessions'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = auth.uid() or public.sao_amigos(user_id, auth.uid()))',
      t || '_ler', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())',
      t || '_inserir', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_atualizar', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())',
      t || '_apagar', t);
  end loop;
end $$;

-- Amizades: vê quem participa; só o remetente cria (sempre "pending");
-- só o destinatário aceita; qualquer um dos dois pode desfazer.
create policy amizades_ler on public.friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy amizades_pedir on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
create policy amizades_aceitar on public.friendships for update to authenticated
  using (addressee_id = auth.uid()) with check (addressee_id = auth.uid() and status = 'accepted');
create policy amizades_desfazer on public.friendships for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
