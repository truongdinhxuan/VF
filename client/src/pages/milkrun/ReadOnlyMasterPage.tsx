import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listMilkrunShops,
  listMilkrunTripStatuses,
  listMilkrunTripTypes,
} from '../../api/milkrun-master-data.service';
import { DataTable, type Column } from '../../components/common/DataTable';
import { CrudPageHeader, ErrorState, StatusBadge, inputClassName } from '../../components/crud/CrudPrimitives';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type {
  MilkrunLookupListParams,
  MilkrunShop,
  MilkrunTripStatusRecord,
  MilkrunTripType,
} from '../../types/milkrun';
import type { PaginationParams } from '../../types/pagination.types';

type ResourceName = 'shops' | 'trip-types' | 'trip-statuses';
type ReadOnlyRecord = MilkrunShop | MilkrunTripType | MilkrunTripStatusRecord;
type MasterQuery = MilkrunLookupListParams & PaginationParams;

const definitions = {
  shops: {
    title: 'Shop',
    description: 'Danh mục Shop của Milkrun. Shop là dữ liệu riêng, không dùng thay cho Area.',
    loader: listMilkrunShops,
    queryKey: queryKeys.milkrunShops.lists,
    defaultSortBy: 'code',
  },
  'trip-types': {
    title: 'Loại chuyến',
    description: 'Các loại chuyến được đọc từ master data; mã hệ thống được bảo vệ ở backend.',
    loader: listMilkrunTripTypes,
    queryKey: queryKeys.milkrunTripTypes.lists,
    defaultSortBy: 'code',
  },
  'trip-statuses': {
    title: 'Trạng thái chuyến',
    description: 'Danh sách trạng thái theo StatusFlow đã cấu hình trong database.',
    loader: listMilkrunTripStatuses,
    queryKey: queryKeys.milkrunTripStatuses.lists,
    defaultSortBy: 'sort_order',
  },
} as const;

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value));

const ReadOnlyMasterPage = ({ resourceName }: { resourceName: ResourceName }) => {
  const definition = definitions[resourceName];
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 400);
  const loader = useCallback(
    (query: MasterQuery, signal: AbortSignal) =>
      definition.loader(query, signal) as Promise<{
        data: ReadOnlyRecord[];
        pagination: {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPreviousPage: boolean;
        };
      }>,
    [definition],
  );
  const resource = usePaginatedResource<ReadOnlyRecord, MasterQuery>({
    loader,
    initialQuery: {
      page: 1,
      pageSize: 20,
      sortBy: definition.defaultSortBy,
      sortOrder: 'asc',
      isActive: true,
      isDeleted: false,
    },
    loadErrorMessage: `Không thể tải danh sách ${definition.title}.`,
    queryKey: definition.queryKey,
  });
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;

  useEffect(() => {
    const search = debouncedSearch.trim() || undefined;
    if (search !== resourceSearch) updateResourceQuery({ search });
  }, [debouncedSearch, resourceSearch, updateResourceQuery]);

  const columns = useMemo<Column<ReadOnlyRecord>[]>(() => {
    const result: Column<ReadOnlyRecord>[] = [
      { header: 'Code', accessor: 'code', sortKey: 'code' },
      { header: 'Tên', accessor: 'name', sortKey: 'name' },
      { header: 'Mô tả', accessor: 'description', render: (item) => item.description || '—' },
    ];
    if (resourceName === 'trip-statuses') {
      result.push({
        header: 'Thứ tự',
        accessor: 'sort_order',
        sortKey: 'sort_order',
        render: (item) => 'sort_order' in item ? item.sort_order : '—',
      });
    }
    if (resourceName !== 'shops') {
      result.push({
        header: 'System',
        accessor: 'is_system',
        render: (item) => 'is_system' in item && item.is_system ? 'System' : 'Custom',
      });
    }
    result.push(
      { header: 'Trạng thái', accessor: 'is_active', sortKey: 'is_active', render: (item) => <StatusBadge active={item.is_active} /> },
      { header: 'Cập nhật', accessor: 'updated_at', sortKey: 'updated_at', render: (item) => formatDate(item.updated_at) },
    );
    return result;
  }, [resourceName]);

  return (
    <section className="space-y-6">
      <CrudPageHeader title={definition.title} description={definition.description} />
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Chế độ chỉ đọc: PermissionsCatalog hiện chưa có permission CRUD riêng cho danh mục này.
      </div>
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.reload()} /> : (
        <DataTable
          columns={columns}
          data={resource.items}
          loading={resource.loading}
          keyExtractor={(item) => item.id}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder={`Tìm code, tên hoặc mô tả ${definition.title}...`}
          renderTopToolbar={() => (
            <select
              value={String(resource.query.isActive ?? true)}
              onChange={(event) => resource.updateQuery({ isActive: event.target.value === 'true' })}
              className={inputClassName}
              aria-label={`Lọc trạng thái ${definition.title}`}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          )}
          pagination={resource.pagination}
          onPageChange={resource.setPage}
          onPageSizeChange={resource.setPageSize}
          sortBy={resource.query.sortBy}
          sortOrder={resource.query.sortOrder}
          onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })}
          emptyText={`Không có ${definition.title} phù hợp.`}
        />
      )}
    </section>
  );
};

export default ReadOnlyMasterPage;
