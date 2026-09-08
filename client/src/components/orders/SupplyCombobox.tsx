import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { listSupplies } from '../../api/supplies.service';
import { APP_LAYER } from '../../constants/layers';
import { useServerLookup } from '../../hooks/useServerLookup';
import { queryKeys } from '../../lib/queryKeys';
import type { SupplyOption } from '../../types/supplies';

interface SupplyComboboxProps {
  value: string;
  selectedSupply?: SupplyOption | null;
  onChange: (supply: SupplyOption | null) => void;
  onSelected?: (supply: SupplyOption) => void;
  disabled?: boolean;
  ariaLabel: string;
  error?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoFocusFlag?: boolean;
}

const supplyOptionLabel = (
  supply: Pick<SupplyOption, 'code' | 'short_text' | 'description'>,
): string => {
  const detail = supply.short_text?.trim() || supply.description?.trim();
  return detail ? `${supply.code} — ${detail}` : supply.code;
};

const optionDomId = (listboxId: string, supplyId: string) => `${listboxId}-opt-${supplyId}`;

const MAX_LIST_HEIGHT = 256;
const MIN_LIST_HEIGHT = 120;

export const SupplyCombobox = ({
  value,
  selectedSupply = null,
  onChange,
  onSelected,
  disabled = false,
  ariaLabel,
  error,
  inputRef,
  autoFocusFlag = false,
}: SupplyComboboxProps) => {
  const listboxId = useId();
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const fieldInputRef = inputRef ?? fallbackInputRef;
  const listRef = useRef<HTMLUListElement | null>(null);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const {
    search,
    setSearch,
    items,
    loading,
    error: lookupError,
  } = useServerLookup<SupplyOption>({
    loader: (searchTerm, signal) => listSupplies(
      {
        page: 1,
        pageSize: 20,
        search: searchTerm,
        isActive: true,
        isDeleted: false,
        sortBy: 'code',
        sortOrder: 'asc',
      },
      signal,
    ),
    queryKey: (searchTerm) => queryKeys.supplies.lookup({
      search: searchTerm,
      pageSize: 20,
      isActive: true,
      isDeleted: false,
    }),
    errorMessage: 'Không thể tải danh sách vật tư.',
    enabled: open,
    delay: 300,
  });

  const options = items;
  const safeHighlightedIndex = Math.min(
    highlightedIndex,
    Math.max(0, options.length - 1),
  );
  const selectedLabel = selectedSupply ? supplyOptionLabel(selectedSupply) : '';

  // Anchor the portaled listbox to the live input rect (fixed positioning) so it
  // is never clipped by the Offcanvas scroll body or hidden behind its sticky
  // footer. Positioning is imperative — no geometry state, no cascading renders.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const input = fieldInputRef.current;
      const list = listRef.current;
      if (!input || !list) return;
      const rect = input.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUp = spaceBelow < MIN_LIST_HEIGHT && spaceAbove > spaceBelow;
      const room = Math.max(MIN_LIST_HEIGHT, Math.min(MAX_LIST_HEIGHT, openUp ? spaceAbove : spaceBelow));
      list.style.left = `${Math.round(rect.left)}px`;
      list.style.width = `${Math.round(rect.width)}px`;
      list.style.top = openUp ? 'auto' : `${Math.round(rect.bottom + 4)}px`;
      list.style.bottom = openUp ? `${Math.round(window.innerHeight - rect.top + 4)}px` : 'auto';
      list.style.maxHeight = `${Math.round(room)}px`;
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, options.length, lookupError, loading, fieldInputRef]);

  // The surrounding Offcanvas closes on a document-capture Escape listener. While
  // the dropdown is open, intercept Escape first so it only dismisses the list.
  useEffect(() => {
    const onEscapeCapture = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !openRef.current) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      setOpen(false);
      setSearch('');
      fieldInputRef.current?.blur();
    };
    document.addEventListener('keydown', onEscapeCapture, true);
    return () => document.removeEventListener('keydown', onEscapeCapture, true);
  }, [fieldInputRef, setSearch]);

  const startEditing = () => {
    if (disabled) return;
    setOpen(true);
    setHighlightedIndex(0);
    setSearch('');
  };

  const stopEditing = () => {
    setOpen(false);
    setSearch('');
  };

  const selectSupply = (supply: SupplyOption) => {
    onChange(supply);
    stopEditing();
    fieldInputRef.current?.blur();
    onSelected?.(supply);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        startEditing();
        return;
      }
      if (options.length === 0) return;
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setHighlightedIndex((current) => {
        const next = Math.min(current, options.length - 1) + direction;
        return (next + options.length) % options.length;
      });
      return;
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      const option = options[safeHighlightedIndex];
      if (option) selectSupply(option);
    }
    // Escape is handled by the document-capture listener above.
  };

  const listbox = open ? createPortal(
    <ul
      ref={listRef}
      id={listboxId}
      role="listbox"
      aria-label={ariaLabel}
      className="fixed overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
      style={{ zIndex: APP_LAYER.primaryDrawerPopover }}
    >
      {loading && options.length === 0 ? (
        <li className="px-3 py-4 text-center text-sm font-normal normal-case text-slate-500">
          Đang tải danh sách vật tư…
        </li>
      ) : lookupError ? (
        <li className="px-3 py-4 text-center text-sm font-normal normal-case text-rose-600">
          {lookupError}
        </li>
      ) : options.length === 0 ? (
        <li className="px-3 py-4 text-center text-sm font-normal normal-case text-slate-500">
          {search.trim() ? 'Không có vật tư phù hợp.' : 'Không có vật tư active.'}
        </li>
      ) : (
        options.map((option, index) => {
          const highlighted = index === safeHighlightedIndex;
          const selected = option.id === value;
          return (
            <li key={option.id} role="none">
              <button
                id={optionDomId(listboxId, option.id)}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSupply(option)}
                className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-normal normal-case transition ${
                  highlighted ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{option.code}</span>
                  {(option.short_text || option.description) && (
                    <span className="block truncate text-xs text-slate-500">
                      {option.short_text?.trim() || option.description?.trim()}
                    </span>
                  )}
                </span>
                {option.category?.code && (
                  <span className="shrink-0 text-xs text-slate-400">{option.category.code}</span>
                )}
              </button>
            </li>
          );
        })
      )}
    </ul>,
    document.body,
  ) : null;

  return (
    <div className="relative space-y-1">
      <input
        ref={fieldInputRef}
        type="text"
        role="combobox"
        data-autofocus={autoFocusFlag ? 'true' : undefined}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && options[safeHighlightedIndex]
            ? optionDomId(listboxId, options[safeHighlightedIndex].id)
            : undefined
        }
        autoComplete="off"
        disabled={disabled}
        value={open ? search : selectedLabel}
        placeholder={selectedLabel || 'Nhập mã hoặc tên vật tư…'}
        onFocus={startEditing}
        onBlur={stopEditing}
        onChange={(event) => {
          setSearch(event.target.value);
          setHighlightedIndex(0);
        }}
        onKeyDown={handleKeyDown}
        className={`w-full rounded-lg border px-3 py-2 text-sm font-normal normal-case text-slate-800 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 ${
          open ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-300 bg-white'
        }`}
      />

      {value && !disabled && !open && (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onChange(null)}
          className="text-xs font-normal normal-case text-slate-500 underline hover:text-rose-600"
        >
          Bỏ chọn vật tư
        </button>
      )}

      {listbox}

      {error && <span className="block normal-case text-rose-600">{error}</span>}
    </div>
  );
};
