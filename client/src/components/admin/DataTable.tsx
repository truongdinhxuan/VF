import React, { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faAnglesLeft,
  faAnglesRight,
} from "@fortawesome/free-solid-svg-icons";

// Định nghĩa kiểu dữ liệu cho Cột
export interface Column<T> {
  header: string; // Tên cột hiển thị trên Header
  accessor: keyof T | string; // Key để lấy dữ liệu từ object
  render?: (item: T) => React.ReactNode; // Hàm tuỳ chỉnh giao diện cho ô
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  renderTopToolbar?: () => React.ReactNode; // Slot để chèn thêm filter (như Role dropdown) hoặc button (Add New)
}

export const DataTable = <T extends object>({
  columns,
  data,
  searchPlaceholder = "Search...",
  renderTopToolbar,
}: DataTableProps<T>) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // 1. Xử lý logic Tìm kiếm (Global Search)
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return data.filter((item) =>
      Object.values(item).some((val) =>
        String(val).toLowerCase().includes(lowerSearchTerm)
      )
    );
  }, [data, searchTerm]);

  // 2. Xử lý logic Phân trang
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  return (
    <div className="w-full space-y-4">
      {/* Top Toolbar: Search & Custom Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Search:</label>
            <div className="relative">
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-64 rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-4 text-sm outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          {/* Chỗ để truyền thêm Dropdown hoặc Button */}
          {renderTopToolbar && renderTopToolbar()}
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {columns.map((col, index) => (
                  <th
                    key={index}
                    className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedData.length > 0 ? (
                paginatedData.map((item, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-slate-50/50 transition-colors bg-white">
                    {columns.map((col, colIndex) => (
                      <td key={colIndex} className="px-6 py-4 text-slate-700">
                        {/* Ưu tiên hàm render tuỳ chỉnh, nếu không thì in giá trị text bình thường */}
                        {col.render
                          ? col.render(item)
                          : String(item[col.accessor as keyof T] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-8 text-center text-slate-500">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Toolbar: Pagination */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between text-sm text-slate-600">
        <div className="flex items-center gap-4">
          <span>
            Page <span className="font-semibold">{totalItems === 0 ? 0 : currentPage}</span> of{" "}
            <span className="font-semibold">{totalPages}</span>
          </span>
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-md border border-slate-300 bg-white py-1.5 px-2 outline-none focus:border-blue-500"
            >
              {[5, 10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pagination Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1 || totalItems === 0}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FontAwesomeIcon icon={faAnglesLeft} className="text-xs" />
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1 || totalItems === 0}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalItems === 0}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || totalItems === 0}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FontAwesomeIcon icon={faAnglesRight} className="text-xs" />
          </button>
        </div>
      </div>
    </div>
  );
};
