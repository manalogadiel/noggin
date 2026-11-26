-- PayMongo checkout session provider_ref attachment and service-role webhook fulfillment RPCs.
-- Reversible by dropping the two RPCs and dropping billing_orders_provider_ref_idx.

create index if not exists billing_orders_provider_ref_idx
  on public.billing_orders (provider_ref)
  where provider_ref is not null;

create or replace function public.attach_billing_order_provider_ref(
  p_order_id uuid,
  p_provider_ref text
)
returns public.billing_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_ref text := nullif(btrim(coalesce(p_provider_ref, '')), '');
  v_order public.billing_orders;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_ref is null then
    raise exception 'p_provider_ref is required';
  end if;

  update public.billing_orders
  set provider_ref = v_ref
  where id = p_order_id
    and user_id = v_user_id
    and status = 'pending'
  returning * into v_order;

  if not found then
    select *
    into v_order
    from public.billing_orders
    where id = p_order_id
      and user_id = v_user_id;

    if not found then
      raise exception 'Billing order % not found', p_order_id;
    end if;
  end if;

  return v_order;
end;
$$;

create or replace function public.fulfill_billing_order_by_provider_ref(
  p_provider_ref text
)
returns setof public.billing_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text := nullif(btrim(coalesce(p_provider_ref, '')), '');
  v_order public.billing_orders;
  v_product public.sales_products;
  v_economy public.player_economy;
  v_total_coins int := 0;
  v_period_end timestamptz;
begin
  if v_ref is null then
    return;
  end if;

  select *
  into v_order
  from public.billing_orders
  where provider_ref = v_ref
  for update;

  if not found then
    return;
  end if;

  if v_order.status = 'paid' then
    return next v_order;
    return;
  end if;

  select *
  into v_product
  from public.sales_products
  where code = v_order.product_code;

  if not found then
    raise exception 'Product % missing', v_order.product_code;
  end if;

  insert into public.player_economy (user_id)
  values (v_order.user_id)
  on conflict (user_id) do nothing;

  select *
  into v_economy
  from public.player_economy
  where user_id = v_order.user_id
  for update;

  if v_product.kind = 'coin_pack' then
    v_total_coins := v_product.coins_grant + v_product.bonus_coins;

    update public.player_economy
    set
      coins = v_economy.coins + v_total_coins,
      updated_at = now()
    where user_id = v_order.user_id
    returning * into v_economy;

    insert into public.coin_ledger (user_id, delta, reason, item_ref, balance_after)
    values (v_order.user_id, v_total_coins, 'topup_purchase', v_product.code, v_economy.coins);
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
    where user_id = v_order.user_id
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
      v_order.user_id,
      'plus',
      v_product.code,
      'active',
      now(),
      v_period_end,
      false,
      v_order.provider,
      v_ref
    );

    update public.profiles
    set plan_code = 'plus'
    where id = v_order.user_id;

    update public.player_economy
    set
      owned_skin_packs = '{"pastel":true,"neon":true,"dark":true,"sunset":true}'::jsonb,
      updated_at = now()
    where user_id = v_order.user_id;
  end if;

  update public.billing_orders
  set
    status = 'paid',
    coins_credited = v_total_coins,
    paid_at = now()
  where id = v_order.id
  returning * into v_order;

  return next v_order;
  return;
end;
$$;

revoke all on function public.attach_billing_order_provider_ref(uuid, text) from public;
grant execute on function public.attach_billing_order_provider_ref(uuid, text) to authenticated;

revoke all on function public.fulfill_billing_order_by_provider_ref(text) from public, anon, authenticated;
grant execute on function public.fulfill_billing_order_by_provider_ref(text) to service_role;
