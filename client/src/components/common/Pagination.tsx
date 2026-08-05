import {
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getButtonClassName } from './Button';

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
        className={getButtonClassName({ variant: 'secondary', size: 'sm' })}
      >
        <FontAwesomeIcon icon={faChevronLeft} className="text-xs" /> Previous
      </button>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNextPage}
        className={getButtonClassName({ variant: 'secondary', size: 'sm' })}
      >
        Next <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
      </button>
    </div>
  </div>
);
