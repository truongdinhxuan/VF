import { useEffect, useMemo, useRef, type Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiErrorMessage } from '../../api/errors';
import { getSupplyProviders } from '../../api/supplies.service';
import { queryKeys } from '../../lib/queryKeys';
import { SelectSkeleton } from './skeleton';

interface SupplyProviderResolveInfo {
  providerCount: number;
  autoSelected: boolean;
  hasError: boolean;
}

interface SupplyProviderSelectProps {
  supplyId: string;
  value: string;
  onChange: (providerId: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  selectRef?: Ref<HTMLSelectElement>;
  /**
   * When the Supply exposes exactly one active Provider, pick it automatically
   * so the operator skips a redundant selection. The field stays visible and
   * editable; the backend still validates the link on create/submit.
   */
  autoSelectSingle?: boolean;
  /**
   * Fired once per Supply when the provider list settles. Lets the parent
   * advance keyboard focus: to Quantity/Stack when a single provider was
   * auto-selected, or onto this control when the operator must still choose.
   */
  onResolve?: (info: SupplyProviderResolveInfo) => void;
}

export const SupplyProviderSelect = ({
  supplyId,
  value,
  onChange,
  onBlur,
  disabled = false,
  className = '',
  ariaLabel = 'Chọn Provider',
  selectRef,
  autoSelectSingle = false,
  onResolve,
}: SupplyProviderSelectProps) => {
  const query = useQuery({
    queryKey: queryKeys.supplyProviders.list(supplyId),
    queryFn: ({ signal }) => getSupplyProviders(supplyId, signal),
    enabled: Boolean(supplyId),
    staleTime: 30 * 60 * 1000,
  });

  const providers = useMemo(() => query.data ?? [], [query.data]);
  const error = query.isError
    ? getApiErrorMessage(query.error, 'Không thể tải Provider của vật tư.')
    : null;

  const autoAppliedForRef = useRef<string | null>(null);
  const resolvedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!supplyId || disabled) return;
    if (query.isPending) return;
    const settled = query.isError || !query.isFetching;
    if (!settled) return;

    const willAutoSelect = autoSelectSingle
      && !query.isError
      && providers.length === 1
      && value !== providers[0]?.id
      && autoAppliedForRef.current !== supplyId;

    if (willAutoSelect) {
      autoAppliedForRef.current = supplyId;
      onChange(providers[0].id);
    }

    if (resolvedForRef.current !== supplyId) {
      resolvedForRef.current = supplyId;
      onResolve?.({
        providerCount: providers.length,
        autoSelected: willAutoSelect || (autoSelectSingle && providers.length === 1),
        hasError: query.isError,
      });
    }
  }, [
    autoSelectSingle,
    disabled,
    supplyId,
    value,
    providers,
    query.isPending,
    query.isError,
    query.isFetching,
    onChange,
    onResolve,
  ]);

  if (supplyId && query.isPending) {
    return <SelectSkeleton label="Đang tải Provider của vật tư" />;
  }

  return (
    <div className="space-y-1">
      <select
        ref={selectRef}
        aria-label={ariaLabel}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || !supplyId || Boolean(error) || providers.length === 0}
        className={className}
      >
        <option value="">
          {!supplyId
            ? 'Chọn vật tư trước'
            : error
              ? 'Không thể tải Provider'
              : providers.length === 0
                ? 'Vật tư chưa có Provider active'
                : 'Chọn Provider'}
        </option>
        {providers.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.code} — {provider.name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs font-normal normal-case text-rose-600">{error}</p>}
    </div>
  );
};
