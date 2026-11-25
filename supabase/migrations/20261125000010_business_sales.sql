-- Sales catalog, billing orders, subscriptions, and transactional order fulfillment RPCs.
-- Reversible by dropping the billing RPCs and dropping public.subscriptions, public.billing_orders, and public.sales_products.

create table if not exists public.sales_products (
  code text primary key,
  kind text not null check (kind in ('coin_pack', 'subscription')),
  name text not null,
  price_centavos int not null check (price_centavos > 0),
  currency text not null default 'PHP',
  coins_grant int not null default 0 check (coins_grant >= 0),
  bonus_coins int not null default 0 check (bonus_coins >= 0),
  billing_interval text check (billing_interval in ('month', 'year')),
  active boolean not null default true
);

insert into public.sales_products (
  code, kind, name, price_centavos, currency, coins_grant, bonus_coins, billing_interval, active
)
values
  ('coins_100', 'coin_pack', '100 Coins', 4900, 'PHP', 100, 0, null, true),
  ('coins_300', 'coin_pack', '300 Coins + 20 Bonus', 11900, 'PHP', 300, 20, null, true),
  ('coins_750', 'coin_pack', '750 Coins + 100 Bonus', 24900, 'PHP', 750, 100, null, true),
  ('coins_1800', 'coin_pack', '1,800 Coins + 350 Bonus', 49900, 'PHP', 1800, 350, null, true),
  ('plus_monthly', 'subscription', 'Noggin Plus Monthly', 24900, 'PHP', 0, 0, 'month', true),
  ('plus_yearly', 'subscription', 'Noggin Plus Yearly', 199000, 'PHP', 0, 0, 'year', true)
on conflict (code) do update
set
  kind = excluded.kind,
  name = excluded.name,
  price_centavos = excluded.price_centavos,
  currency = excluded.currency,
  coins_grant = excluded.coins_grant,
  bonus_coins = excluded.bonus_coins,
  billing_interval = excluded.billing_interval,
  active = excluded.active;

create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_code text not null references public.sales_products (code),
  idempotency_key text not null,
  status text not null check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  amount_centavos int not null check (amount_centavos > 0),
  currency text not null default 'PHP',
  provider text not null default 'sandbox',
  provider_ref text,
  coins_credited int not null default 0 check (coins_credited >= 0),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists billing_orders_user_created_idx
  on public.billing_orders (user_id, created_at desc);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_code text not null references public.plans (code),
  product_code text not null references public.sales_products (code),
  status text not null check (status in ('active', 'cancelled', 'expired', 'past_due')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  provider text not null default 'sandbox',
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_status_idx
  on public.subscriptions (user_id, status, current_period_end desc);

alter table public.sales_products enable row level security;
alter table public.billing_orders enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists sales_products_select_authenticated on public.sales_products;
create policy sales_products_select_authenticated
  on public.sales_products
  for select
  to authenticated
  using (active = true);

drop policy if exists billing_orders_select_own on public.billing_orders;
create policy billing_orders_select_own
  on public.billing_orders
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.create_billing_order(
  p_product_code text,
  p_idempotency_key text,
  p_provider text default 'sandbox'
)
returns public.billing_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_product public.sales_products;
  v_order public.billing_orders;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(btrim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'p_idempotency_key is required';
  end if;

  select *
  into v_product
  from public.sales_products
  where code = p_product_code
    and active = true;

  if not found then
    raise exception 'Unknown or inactive product code: %', p_product_code;
  end if;

  select *
  into v_order
  from public.billing_orders
  where user_id = v_user_id
    and idempotency_key = p_idempotency_key;

  if found then
    return v_order;
  end if;

  insert into public.billing_orders (
    user_id,
    product_code,
    idempotency_key,
    status,
    amount_centavos,
    currency,
    provider
  )
  values (
    v_user_id,
    v_product.code,
    p_idempotency_key,
    'pending',
    v_product.price_centavos,
    v_product.currency,
    coalesce(nullif(btrim(p_provider), ''), 'sandbox')
  )
  on conflict (user_id, idempotency_key) do nothing
  returning * into v_order;

  if not found then
    select *
    into v_order
    from public.billing_orders
    where user_id = v_user_id
      and idempotency_key = p_idempotency_key;
  end if;

  return v_order;
end;
$$;

create or replace function public.fulfill_billing_order(
  p_order_id uuid,
  p_provider_ref text default null
)
returns public.billing_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.billing_orders;
  v_product public.sales_products;
  v_economy public.player_economy;
  v_total_coins int := 0;
  v_period_end timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_order
  from public.billing_orders
  where id = p_order_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Billing order % not found', p_order_id;
  end if;

  if v_order.status = 'paid' then
    return v_order;
  end if;

  select *
  into v_product
  from public.sales_products
  where code = v_order.product_code;

  if not found then
    raise exception 'Product % missing', v_order.product_code;
  end if;

  insert into public.player_economy (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select *
  into v_economy
  from public.player_economy
  where user_id = v_user_id
  for update;

  if v_product.kind = 'coin_pack' then
    v_total_coins := v_product.coins_grant + v_product.bonus_coins;

    update public.player_economy
    set
      coins = v_economy.coins + v_total_coins,
      updated_at = now()
    where user_id = v_user_id
    returning * into v_economy;

    insert into public.coin_ledger (user_id, delta, reason, item_ref, balance_after)
    values (v_user_id, v_total_coins, 'topup_purchase', v_product.code, v_economy.coins);
  else
    v_period_end := case
      when v_product.billing_interval = 'year' then now() + interval '1 year'
      else now() + interval '1 month'
    end;

    update public.subscriptions
    set
      status = 'cancelled',
      cancel_at_period_end = false,
      updated_at = now()
    where user_id = v_user_id
      and status = 'active';

    insert into public.subscriptions (
      user_id,
      plan_code,
      product_code,
      status,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      provider,
      provider_subscription_id
    )
    values (
      v_user_id,
      'plus',
      v_product.code,
      'active',
      now(),
      v_period_end,
      false,
      v_order.provider,
      p_provider_ref
    );

    update public.profiles
    set plan_code = 'plus'
    where id = v_user_id;

    update public.player_economy
    set
      owned_skin_packs = '{"pastel":true,"neon":true,"dark":true,"sunset":true}'::jsonb,
      updated_at = now()
    where user_id = v_user_id;
  end if;

  update public.billing_orders
  set
    status = 'paid',
    provider_ref = coalesce(p_provider_ref, provider_ref),
    coins_credited = v_total_coins,
    paid_at = now()
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

create or replace function public.cancel_user_subscription()
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_sub public.subscriptions;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.subscriptions
  set
    cancel_at_period_end = true,
    updated_at = now()
  where user_id = v_user_id
    and status = 'active'
  returning * into v_sub;

  if not found then
    raise exception 'No active subscription found';
  end if;

  return v_sub;
end;
$$;

revoke all on function public.create_billing_order(text, text, text) from public;
grant execute on function public.create_billing_order(text, text, text) to authenticated;

revoke all on function public.fulfill_billing_order(uuid, text) from public;
grant execute on function public.fulfill_billing_order(uuid, text) to authenticated;

revoke all on function public.cancel_user_subscription() from public;
grant execute on function public.cancel_user_subscription() to authenticated;

grant select on public.sales_products to authenticated;
grant select on public.billing_orders to authenticated;
grant select on public.subscriptions to authenticated;
