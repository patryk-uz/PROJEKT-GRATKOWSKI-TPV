-- Uruchom raz w Supabase SQL Editor jako postgres. W razie konfliktu nazw
-- skrypt wycofa cala transakcje; nie usuwa istniejacych tabel.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema casino_private;
revoke all on schema casino_private from public, anon, authenticated;
grant usage on schema casino_private to authenticated;

create table public.casino_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 1000 check (balance between 0 and 1000000000),
  last_play_at timestamptz
);
create table public.casino_rounds (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  played_at timestamptz not null default clock_timestamp(),
  bet integer not null check (bet between 1 and 1000),
  bet_type text not null check (bet_type in ('red','black','even','odd','number')),
  chosen_number integer,
  result integer not null check (result between 0 and 36),
  payout integer not null check (payout between 0 and 36000),
  balance_after bigint not null check (balance_after between 0 and 1000000000),
  primary key (user_id, request_id),
  check ((bet_type = 'number' and chosen_number is not null and chosen_number between 0 and 36)
    or (bet_type <> 'number' and chosen_number is null))
);
create index casino_rounds_history on public.casino_rounds(user_id, played_at desc);
alter table public.casino_wallets enable row level security;
alter table public.casino_rounds enable row level security;
revoke all on public.casino_wallets, public.casino_rounds from public, anon, authenticated;
grant select on public.casino_wallets, public.casino_rounds to authenticated;
create policy own_wallet on public.casino_wallets for select to authenticated
  using ((select auth.uid()) = user_id);
create policy own_rounds on public.casino_rounds for select to authenticated
  using ((select auth.uid()) = user_id);

create function casino_private.player_id() returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null or not exists (select 1 from auth.users where id = u and email_confirmed_at is not null) then
    raise exception 'Zaloguj sie na konto z potwierdzonym adresem e-mail.';
  end if;
  return u;
end;
$$;

create function casino_private.open_wallet() returns bigint
language plpgsql security definer set search_path = '' as $$
declare u uuid := casino_private.player_id(); b bigint;
begin
  insert into public.casino_wallets(user_id) values(u) on conflict(user_id) do nothing;
  select balance into b from public.casino_wallets where user_id = u;
  return b;
end;
$$;
create function public.casino_open_wallet() returns bigint
language sql security invoker set search_path = '' as $$
  select casino_private.open_wallet();
$$;

create function casino_private.spin(p_request_id uuid, p_bet integer, p_type text, p_number integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := casino_private.player_id();
  w public.casino_wallets%rowtype;
  r public.casino_rounds%rowtype;
  b bytea; n integer; multiplier integer := 0; prize integer; next_balance bigint;
begin
  if p_request_id is null or p_bet is null or p_bet < 1 or p_bet > 1000
    or p_type is null or p_type not in ('red','black','even','odd','number') then
    raise exception 'Niepoprawny zaklad. Stawka: 1-1000 calych zetonow.';
  end if;
  if (p_type = 'number' and (p_number is null or p_number < 0 or p_number > 36))
    or (p_type <> 'number' and p_number is not null) then
    raise exception 'Niepoprawny numer zakladu.';
  end if;
  insert into public.casino_wallets(user_id) values(u) on conflict(user_id) do nothing;
  -- Jeden lock na gracza: rownolegle zaklady nie wydadza tych samych srodkow.
  select * into w from public.casino_wallets where user_id = u for update;
  select * into r from public.casino_rounds where user_id = u and request_id = p_request_id;
  if found then
    if r.bet <> p_bet or r.bet_type <> p_type or r.chosen_number is distinct from p_number then
      raise exception 'Identyfikator proby byl juz uzyty dla innego zakladu.';
    end if;
    return to_jsonb(r); -- Retry nie pobiera ponownie stawki.
  end if;
  if w.last_play_at is not null and clock_timestamp() < w.last_play_at + interval '2 seconds' then
    raise exception 'Poczekaj 2 sekundy przed kolejnym zakladem.';
  end if;
  if p_bet > w.balance then raise exception 'Za malo zetonow.'; end if;
  -- Bez przewidywalnego random(); odrzucenie usuwa obciazenie modulo.
  loop
    b := extensions.gen_random_bytes(2);
    n := get_byte(b,0) * 256 + get_byte(b,1);
    exit when n < 65527;
  end loop;
  n := n % 37;
  if p_type = 'number' and n = p_number then multiplier := 36;
  elsif p_type = 'red' and n = any(array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]) then multiplier := 2;
  elsif p_type = 'black' and n <> 0 and not (n = any(array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])) then multiplier := 2;
  elsif p_type = 'even' and n <> 0 and n % 2 = 0 then multiplier := 2;
  elsif p_type = 'odd' and n % 2 = 1 then multiplier := 2;
  end if;
  prize := p_bet * multiplier;
  next_balance := w.balance - p_bet + prize;
  if next_balance > 1000000000 then raise exception 'Osiagnieto limit salda.'; end if;
  update public.casino_wallets set balance = next_balance, last_play_at = clock_timestamp() where user_id = u;
  insert into public.casino_rounds(user_id,request_id,bet,bet_type,chosen_number,result,payout,balance_after)
    values(u,p_request_id,p_bet,p_type,p_number,n,prize,next_balance) returning * into r;
  return to_jsonb(r);
end;
$$;
create function public.casino_spin(p_request_id uuid, p_bet integer, p_type text, p_number integer default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select casino_private.spin(p_request_id,p_bet,p_type,p_number);
$$;
revoke all on all functions in schema casino_private from public, anon, authenticated;
grant execute on function casino_private.open_wallet() to authenticated;
grant execute on function casino_private.spin(uuid,integer,text,integer) to authenticated;
revoke all on function public.casino_open_wallet() from public, anon, authenticated;
revoke all on function public.casino_spin(uuid,integer,text,integer) from public, anon, authenticated;
grant execute on function public.casino_open_wallet() to authenticated;
grant execute on function public.casino_spin(uuid,integer,text,integer) to authenticated;
commit;
