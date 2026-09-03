import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { UnitForm } from '../../src/components/catalog/UnitForm';
import { AppTooltipProvider } from '../../src/components/common/AppTooltip';
import { CrudFeedbackToast } from '../../src/components/crud/CrudPrimitives';
import {
  DrawerFormFooter,
  OffcanvasProvider,
} from '../../src/components/offcanvas';
import { useCrudOffcanvas } from '../../src/hooks/useCrudOffcanvas';
import type { CrudFeedback } from '../../src/hooks/useCrudResource';
import type { CreateUnitInput } from '../../src/types/units';

const sleep = (milliseconds: number) => new Promise((resolve) => {
  window.setTimeout(resolve, milliseconds);
});

export const DrawerBody = ({
  formId,
  onSaved,
  onToast,
  onRefetch,
}: {
  formId: string;
  onSaved: () => void;
  onToast: () => void;
  onRefetch: () => void;
}) => {
  const { closePrimary, openConfirm, updatePrimary } = useCrudOffcanvas();
  const [serverError, setServerError] = useState<string | null>(null);
  const handleDirtyChange = useCallback((isDirty: boolean) => {
    updatePrimary({ isDirty });
  }, [updatePrimary]);
  const handleSubmittingChange = useCallback((isBusy: boolean) => {
    updatePrimary({ isBusy });
  }, [updatePrimary]);

  return (
    <div className="space-y-4">
      <UnitForm
        formId={formId}
        item={null}
        serverError={serverError}
        onDirtyChange={handleDirtyChange}
        onSubmittingChange={handleSubmittingChange}
        onSave={async (values: CreateUnitInput) => {
          await sleep(500);
          if (values.code === 'DUPLICATE') {
            setServerError('Mã đơn vị đã tồn tại.');
            return false;
          }
          onSaved();
          closePrimary();
          return true;
        }}
      />
      <button
        type="button"
        className="rounded-lg bg-amber-500 px-4 py-2 text-white"
        onClick={() => openConfirm({
          title: 'Xác nhận thử nghiệm',
          description: 'Confirmation phải nằm trên Primary.',
          confirmLabel: 'Đồng ý',
          onConfirm: () => undefined,
        })}
      >
        Mở confirmation
      </button>
      <button
        type="button"
        className="ml-2 rounded-lg bg-slate-700 px-4 py-2 text-white"
        onClick={onToast}
      >
        Hiển thị toast
      </button>
      <button
        type="button"
        className="ml-2 rounded-lg bg-indigo-600 px-4 py-2 text-white"
        onClick={onRefetch}
      >
        Mô phỏng list refetch
      </button>
      <div className="h-[900px] rounded-xl bg-gradient-to-b from-blue-50 to-slate-100 p-4 text-sm text-slate-600">
        Nội dung dài dùng để kiểm tra body scroll độc lập.
      </div>
    </div>
  );
};

export const DrawerFooter = ({ formId }: { formId: string }) => {
  const { requestClosePrimary } = useCrudOffcanvas();
  return (
    <DrawerFormFooter
      formId={formId}
      submitLabel="Tạo"
      onCancel={() => requestClosePrimary('cancel')}
    />
  );
};

export const Harness = () => {
  const { openConfirm, openCreate } = useCrudOffcanvas();
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);
  const [search, setSearch] = useState('mm');
  const [page, setPage] = useState(3);
  const [sort, setSort] = useState('code:asc');
  const [saveCount, setSaveCount] = useState(0);
  const [refetchCount, setRefetchCount] = useState(0);
  const formId = 'manual-unit-form';

  return (
    <main className="min-h-[1400px] bg-slate-100 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Units Offcanvas runtime harness</h1>
      <p className="mt-2 text-slate-600">Dùng UnitForm thật; không được bundle vào production entry.</p>
      <p className="mt-1 text-sm text-slate-500">Save calls: {saveCount}</p>
      <p className="mt-1 text-sm text-slate-500">List refetches: {refetchCount}</p>
      <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            Search
            <input
              aria-label="Search state"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Page
            <input
              aria-label="Page state"
              type="number"
              value={page}
              onChange={(event) => setPage(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Sort
            <select
              aria-label="Sort state"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="code:asc">Mã tăng dần</option>
              <option value="code:desc">Mã giảm dần</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-3 text-white"
            onClick={(event) => openCreate({
              title: 'Tạo đơn vị',
              description: 'UnitForm thực tế của Phase 2',
              content: (
                <DrawerBody
                  formId={formId}
                  onSaved={() => {
                    setSaveCount((current) => current + 1);
                    setFeedback({ type: 'success', message: 'Tạo đơn vị thành công.' });
                  }}
                  onToast={() => setFeedback({ type: 'error', message: 'Lỗi thử nghiệm trong drawer.' })}
                  onRefetch={() => setRefetchCount((current) => current + 1)}
                />
              ),
              footer: <DrawerFooter formId={formId} />,
              triggerElement: event.currentTarget,
              preventCloseWhileBusy: true,
            })}
          >
            Thêm đơn vị
          </button>
          <button
            type="button"
            className="rounded-lg bg-amber-500 px-4 py-3 text-white"
            onClick={(event) => openConfirm({
              title: 'Ngừng sử dụng đơn vị?',
              description: 'Kiểm tra standalone confirmation và return focus.',
              confirmLabel: 'Ngừng sử dụng',
              cancelLabel: 'Hủy',
              triggerElement: event.currentTarget,
              onConfirm: () => setFeedback({
                type: 'success',
                message: 'Ngừng sử dụng đơn vị thành công.',
              }),
            })}
          >
            Deactivate test
          </button>
        </div>
        <div
          data-testid="list-scroll-owner"
          className="mt-4 h-64 overflow-y-auto rounded-xl border border-slate-200 p-3"
        >
          {Array.from({ length: 30 }, (_, index) => (
            <div key={index} className="border-b border-slate-100 py-3 text-sm text-slate-600">
              Unit row {index + 1} · search={search} · page={page} · sort={sort}
            </div>
          ))}
        </div>
      </section>
      <CrudFeedbackToast feedback={feedback} onClose={() => setFeedback(null)} />
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppTooltipProvider>
      <OffcanvasProvider>
        <Harness />
      </OffcanvasProvider>
    </AppTooltipProvider>
  </StrictMode>,
);
