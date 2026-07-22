import {
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export const Pagination = ({
  page,
  pageSize,
  total,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) => (
  <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex flex-wrap items-center gap-4">
      <span>
        Tổng <strong className="text-slate-900">{total}</strong> bản ghi
      </span>
      <span>
        Trang <strong className="text-slate-900">{totalPages === 0 ? 0 : page}</strong> /{' '}
        <strong className="text-slate-900">{totalPages}</strong>
      </span>
      <label className="flex items-center gap-2">
        Hiển thị
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 outline-none focus:border-blue-500"
        >
          {[10, 20, 50, 100].map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </label>
    </div>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPreviousPage}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <FontAwesomeIcon icon={faChevronLeft} className="text-xs" /> Previous
      </button>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNextPage}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
      </button>
    </div>
  </div>
);
