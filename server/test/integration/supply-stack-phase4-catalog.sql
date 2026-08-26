select jsonb_build_object(
  'tables', jsonb_build_object(
    'order_item_allocations',
      to_regclass('public.order_item_allocations') is not null,
    'inventory_discrepancies',
      to_regclass('public.inventory_discrepancies') is not null
  ),
  'function', (
    select jsonb_build_object(
      'identity_arguments', pg_get_function_identity_arguments(proc.oid),
      'result', pg_get_function_result(proc.oid),
      'security_definer', proc.prosecdef,
      'config', proc.proconfig,
      'owner', pg_get_userbyid(proc.proowner),
      'definition', pg_get_functiondef(proc.oid)
    )
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'allocate_stack_order'
  ),
  'permission', (
    select jsonb_build_object(
      'code', permission.code,
      'active', permission.is_active,
      'deleted', permission.is_deleted,
      'assigned_roles', coalesce((
        select jsonb_agg(role_record.code order by role_record.code)
        from public.role_permissions mapping
        join public.roles role_record on role_record.id = mapping.role_id
        where mapping.permission_id = permission.id
          and mapping.is_active = true
          and mapping.is_deleted = false
      ), '[]'::jsonb)
    )
    from public.permissions permission
    where permission.code = 'supply.order.allocate'
  )
) as verification;
