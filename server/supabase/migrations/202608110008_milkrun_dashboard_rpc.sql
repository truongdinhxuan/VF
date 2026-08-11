-- Phase 10: read-only Milkrun dashboard metrics.
-- Aggregates are calculated from operational tables and are not persisted.

begin;

create or replace function milkrun.get_dashboard(
  p_actor_id uuid,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_driver_id uuid default null,
  p_shop_id uuid default null,
  p_status_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = milkrun, public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.has_permission(p_actor_id, 'milkrun.dashboard.read') then
    raise exception 'Permission denied: milkrun.dashboard.read';
  end if;

  with filtered_trips as materialized (
    select trip.*
    from milkrun.trips trip
    where trip.is_active
      and not trip.is_deleted
      and (p_date_from is null or trip.created_at >= p_date_from)
      and (p_date_to is null or trip.created_at <= p_date_to)
      and (p_driver_id is null or trip.driver_id = p_driver_id)
      and (p_shop_id is null or trip.shop_id = p_shop_id)
      and (p_status_id is null or trip.status_id = p_status_id)
  ),
  current_stock_rows as materialized (
    select
      rack.id,
      rack.code,
      rack.name,
      sum(balance.quantity) as quantity
    from milkrun.stock_balances balance
    join milkrun.racks rack
      on rack.id = balance.rack_id
    join public.areas area
      on area.id = balance.area_id
    where balance.is_active
      and not balance.is_deleted
      and rack.is_active
      and not rack.is_deleted
      and area.code = 'EDC_LOGISTICS'
      and area.is_active
      and not area.is_deleted
    group by rack.id, rack.code, rack.name
  )
  select jsonb_build_object(
    'total_trips', (select count(*) from filtered_trips),
    'top_shop', (
      select jsonb_build_object(
        'id', shop.id,
        'code', shop.code,
        'name', shop.name,
        'trip_count', count(*)
      )
      from filtered_trips trip
      join milkrun.shops shop on shop.id = trip.shop_id
      group by shop.id, shop.code, shop.name
      order by count(*) desc, shop.code asc
      limit 1
    ),
    'trips_by_driver', coalesce((
      select jsonb_agg(driver_row order by driver_row.trip_count desc, driver_row.vinfast_id asc)
      from (
        select
          driver.id,
          driver.vinfast_id,
          driver.first_name,
          driver.last_name,
          count(*) as trip_count
        from filtered_trips trip
        join public.users driver on driver.id = trip.driver_id
        group by driver.id, driver.vinfast_id, driver.first_name, driver.last_name
      ) driver_row
    ), '[]'::jsonb),
    'driver_shop_time', coalesce((
      select jsonb_agg(driver_time order by driver_time.total_minutes desc, driver_time.vinfast_id asc)
      from (
        select
          driver.id,
          driver.vinfast_id,
          driver.first_name,
          driver.last_name,
          count(*) as visit_count,
          round(sum(extract(epoch from (trip.time_lift_down - trip.time_arrived))) / 60.0, 2)
            as total_minutes,
          round(avg(extract(epoch from (trip.time_lift_down - trip.time_arrived))) / 60.0, 2)
            as average_minutes
        from filtered_trips trip
        join public.users driver on driver.id = trip.driver_id
        where trip.time_arrived is not null
          and trip.time_lift_down is not null
          and trip.time_lift_down >= trip.time_arrived
        group by driver.id, driver.vinfast_id, driver.first_name, driver.last_name
      ) driver_time
    ), '[]'::jsonb),
    'trip_duration', (
      select jsonb_build_object(
        'trip_count', count(*),
        'average_minutes', round(
          avg(extract(epoch from (trip.time_arrived - trip.time_start))) / 60.0,
          2
        )
      )
      from filtered_trips trip
      where trip.time_start is not null
        and trip.time_arrived is not null
        and trip.time_arrived >= trip.time_start
    ),
    'top_received_rack', (
      select jsonb_build_object(
        'id', rack.id,
        'code', rack.code,
        'name', rack.name,
        'quantity', sum(item.quantity)
      )
      from filtered_trips trip
      join milkrun.trip_statuses status on status.id = trip.status_id
      join milkrun.trip_types trip_type on trip_type.id = trip.trip_type_id
      join milkrun.trip_items item
        on item.trip_id = trip.id and item.is_active and not item.is_deleted
      join milkrun.racks rack on rack.id = item.rack_id
      where status.code = 'COMPLETED'
        and trip_type.code = 'RECEIVE_RACK'
      group by rack.id, rack.code, rack.name
      order by sum(item.quantity) desc, rack.code asc
      limit 1
    ),
    'top_returned_rack', (
      select jsonb_build_object(
        'id', rack.id,
        'code', rack.code,
        'name', rack.name,
        'quantity', sum(item.quantity)
      )
      from filtered_trips trip
      join milkrun.trip_statuses status on status.id = trip.status_id
      join milkrun.trip_types trip_type on trip_type.id = trip.trip_type_id
      join milkrun.trip_items item
        on item.trip_id = trip.id and item.is_active and not item.is_deleted
      join milkrun.racks rack on rack.id = item.rack_id
      where status.code = 'COMPLETED'
        and trip_type.code = 'RETURN_RACK'
      group by rack.id, rack.code, rack.name
      order by sum(item.quantity) desc, rack.code asc
      limit 1
    ),
    'current_stock', jsonb_build_object(
      'total_quantity', coalesce((select sum(quantity) from current_stock_rows), 0),
      'racks', coalesce((
        select jsonb_agg(stock_row order by stock_row.quantity desc, stock_row.code asc)
        from current_stock_rows stock_row
      ), '[]'::jsonb)
    ),
    'adjustment_count', (
      select count(*)
      from milkrun.stock_transactions stock_tx
      join milkrun.stock_transaction_types transaction_type
        on transaction_type.id = stock_tx.transaction_type_id
      where stock_tx.is_active
        and not stock_tx.is_deleted
        and transaction_type.code in ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT')
        and (p_date_from is null or stock_tx.created_at >= p_date_from)
        and (p_date_to is null or stock_tx.created_at <= p_date_to)
        and (p_driver_id is null or stock_tx.created_by = p_driver_id)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function milkrun.get_dashboard(
  uuid, timestamptz, timestamptz, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function milkrun.get_dashboard(
  uuid, timestamptz, timestamptz, uuid, uuid, uuid
) to service_role;

commit;
