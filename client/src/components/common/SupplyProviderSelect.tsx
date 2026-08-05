import { useQuery } from '@tanstack/react-query';
import { getApiErrorMessage } from '../../api/errors';
import { getSupplyProviders } from '../../api/supplies.service';
import { queryKeys } from '../../lib/queryKeys';
import { SelectSkeleton } from './skeleton';

interface SupplyProviderSelectProps {
  supplyId: string;
  value: string;
  onChange: (providerId: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export const SupplyProviderSelect = ({
  supplyId,
  value,
  onChange,
  onBlur,
  disabled = false,
  className = '',
  ariaLabel = 'Chọn Provider',
}: SupplyProviderSelectProps) => {
  const query = useQuery({
    queryKey: queryKeys.supplyProviders.list(supplyId),
    queryFn: ({ signal }) => getSupplyProviders(supplyId, signal),
    enabled: Boolean(supplyId),
    staleTime: 30 * 60 * 1000,
  });

  if (supplyId && query.isPending) {
    return <SelectSkeleton label="Đang tải Provider của vật tư" />;
  }

  const providers = query.data ?? [];
  const error = query.isError
    ? getApiErrorMessage(query.error, 'Không thể tải Provider của vật tư.')
    : null;

  return (
    <div className="space-y-1">
      <select
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
