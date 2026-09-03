import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import {
  createAndSubmitOrder,
  DraftSubmitError,
} from '../src/components/orders/createOrderOrchestration.ts';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Phase 3 Shift Order create orchestration', () => {
  it('creates one Draft and submits that same Draft to PENDING', async () => {
    const stages = [];
    let createCount = 0;
    let submitCount = 0;
    const result = await createAndSubmitOrder({
      draft: null,
      createDraft: async () => {
        createCount += 1;
        return { id: 'draft-1', status: 'DRAFT' };
      },
      submitDraft: async (draft) => {
        submitCount += 1;
        assert.equal(draft.id, 'draft-1');
        return { ...draft, status: 'PENDING', shift_order_sheet_id: 'sheet-1' };
      },
      onDraftCreated: () => undefined,
      onStageChange: (stage) => stages.push(stage),
    });

    assert.equal(createCount, 1);
    assert.equal(submitCount, 1);
    assert.equal(result.status, 'PENDING');
    assert.deepEqual(stages, ['creating-draft', 'draft-created', 'submitting', 'success']);
  });

  it('retries submit without creating a duplicate Draft', async () => {
    let persistedDraft = null;
    let createCount = 0;
    let submitCount = 0;
    const createDraft = async () => {
      createCount += 1;
      return { id: 'draft-retry', code: 'ORD-RETRY' };
    };
    const submitDraft = async (draft) => {
      submitCount += 1;
      if (submitCount === 1) throw new Error('ORDER_ITEM_ZERO_STOCK');
      return { ...draft, status: 'PENDING' };
    };

    await assert.rejects(
      createAndSubmitOrder({
        draft: persistedDraft,
        createDraft,
        submitDraft,
        onDraftCreated: (draft) => { persistedDraft = draft; },
        onStageChange: () => undefined,
      }),
      DraftSubmitError,
    );

    const result = await createAndSubmitOrder({
      draft: persistedDraft,
      createDraft,
      submitDraft,
      onDraftCreated: (draft) => { persistedDraft = draft; },
      onStageChange: () => undefined,
    });

    assert.equal(createCount, 1);
    assert.equal(submitCount, 2);
    assert.equal(result.status, 'PENDING');
  });

  it('does not call submit when Draft creation fails', async () => {
    let submitCount = 0;
    await assert.rejects(createAndSubmitOrder({
      draft: null,
      createDraft: async () => { throw new Error('create failed'); },
      submitDraft: async () => {
        submitCount += 1;
        return null;
      },
      onDraftCreated: () => undefined,
      onStageChange: () => undefined,
    }), /create failed/);
    assert.equal(submitCount, 0);
  });
});

describe('Phase 3 Create Order offcanvas contract', () => {
  it('extracts a route-independent RHF form and keeps the legacy route wrapper', () => {
    const form = read('src/components/orders/CreateOrderForm.tsx');
    const page = read('src/pages/orders/CreateOrderPage.tsx');
    assert.match(form, /useForm<CreateOrderFormValues>/);
    assert.match(form, /useFieldArray/);
    assert.doesNotMatch(form, /useNavigate|useSearchParams|<Link/);
    assert.match(page, /<CreateOrderForm/);
    assert.match(page, /mode="draft-only"/);
    assert.match(page, /navigate\(`\$\{ordersPath\}\/\$\{order\.id\}/);
  });

  it('opens creation on the Sheet through shared offcanvas without route navigation', () => {
    const sheet = read('src/pages/orders/ShiftOrderSheetDetailPage.tsx');
    assert.match(sheet, /openCrud\(/);
    assert.match(sheet, /mode="shift-sheet-submit"/);
    assert.match(sheet, /Gửi Order/);
    assert.doesNotMatch(sheet, /createPath/);
    assert.doesNotMatch(sheet, /orders\/create\?shiftOrderSheetId/);
  });

  it('uses effective permission and targeted query invalidation', () => {
    const sheet = read('src/pages/orders/ShiftOrderSheetDetailPage.tsx');
    assert.match(sheet, /hasPermission\(PERMISSION_CODE\.SUPPLY_ORDER_CREATE\)/);
    assert.doesNotMatch(sheet, /role\s*===|role\.includes|switch\s*\(\s*role/);
    assert.match(sheet, /queryKeys\.orders\.lists/);
    assert.match(sheet, /queryKeys\.shiftOrderSheets\.detail\(id\)/);
    assert.match(sheet, /queryKeys\.shiftOrderSheets\.lists/);
    assert.doesNotMatch(sheet, /queryKeys\.stockBalances|queryClient\.clear/);
  });

  it('locks persisted Draft values and exposes explicit recovery actions', () => {
    const form = read('src/components/orders/CreateOrderForm.tsx');
    const sheet = read('src/pages/orders/ShiftOrderSheetDetailPage.tsx');
    assert.match(form, /const formLocked = Boolean\(draftOrder\)/);
    assert.match(form, /Order nháp .* đã được tạo nhưng chưa thể gửi/);
    assert.doesNotMatch(form, /reset\(/);
    assert.match(sheet, /Thử gửi lại/);
    assert.match(sheet, /Mở Order nháp/);
    assert.match(sheet, /Order nháp chưa được gửi/);
  });

  it('preserves Stack, Provider and fixed Area behavior in the shared form', () => {
    const form = read('src/components/orders/CreateOrderForm.tsx');
    assert.match(form, /ORDER_SOURCE_AREA_CODE = 'VTDG'/);
    assert.match(form, /<SupplyProviderSelect/);
    assert.match(form, /<OrderStackFields/);
    assert.match(form, /requested_stack_quantity/);
    assert.match(form, /requested_total_set_quantity/);
    assert.match(form, /sheetContext\.area_id !== receivingAreaId/);
  });

  it('keeps busy close protection, dirty state and focus integration', () => {
    const form = read('src/components/orders/CreateOrderForm.tsx');
    const sheet = read('src/pages/orders/ShiftOrderSheetDetailPage.tsx');
    assert.match(form, /if \(isBusy\) return/);
    assert.match(form, /isDirty: isDirty && !draftOrder/);
    assert.match(sheet, /preventCloseWhileBusy: true/);
    assert.match(sheet, /initialFocusRef/);
    assert.match(sheet, /requestPersistedDraftClose/);
  });
});
