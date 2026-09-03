import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Phase 1 Offcanvas foundation contract', () => {
  it('mounts one provider at the authenticated workspace shell without moving SSE', () => {
    const layout = read('src/layouts/workspace/WorkspaceLayout.tsx');
    assert.match(layout, /const realtime = useSupplyRealtime\(\)/);
    assert.equal((layout.match(/<OffcanvasProvider/g) ?? []).length, 1);
    assert.equal((layout.match(/useSupplyRealtime\(\)/g) ?? []).length, 1);
    assert.match(layout, /<OffcanvasProvider[\s\S]*?<Sidebar[\s\S]*?<main/);
  });

  it('models at most one primary and one confirmation drawer', () => {
    const types = read('src/types/offcanvas.types.ts');
    const provider = read('src/components/offcanvas/OffcanvasProvider.tsx');
    assert.match(types, /primary: CrudDrawerEntry \| null/);
    assert.match(types, /confirmation: ConfirmDrawerEntry \| null/);
    assert.match(provider, /stateRef\.current\.confirmation/);
    assert.match(provider, /warnStackLimit\(\)/);
  });

  it('keeps convenience callbacks stable while drawer state changes', () => {
    const hook = read('src/hooks/useCrudOffcanvas.ts');
    assert.match(hook, /const \{ openCrud, openConfirm: openConfirmDrawer \} = context/);
    assert.match(hook, /\[openCrud\]/);
    assert.match(hook, /\[openConfirmDrawer\]/);
    assert.doesNotMatch(hook, /\[context\]/);
  });

  it('funnels close sources through a typed close reason contract', () => {
    const types = read('src/types/offcanvas.types.ts');
    const offcanvas = read('src/components/offcanvas/Offcanvas.tsx');
    for (const reason of ['close-button', 'escape', 'backdrop', 'cancel', 'programmatic']) {
      assert.match(types, new RegExp(`'${reason}'`));
    }
    assert.match(offcanvas, /onRequestClose\('backdrop'\)/);
    assert.match(offcanvas, /onRequestClose\('close-button'\)/);
  });

  it('supports dirty confirmation, continue editing and ordered discard', () => {
    const provider = read('src/components/offcanvas/OffcanvasProvider.tsx');
    assert.match(provider, /if \(primary\.isDirty\)/);
    assert.match(provider, /Thay đổi chưa được lưu/);
    assert.match(provider, /Tiếp tục chỉnh sửa/);
    assert.match(provider, /Bỏ thay đổi/);
    assert.match(provider, /beginClose\('confirmation',[\s\S]*?afterClosed: \(\) => beginClose\('primary'\)/);
  });

  it('blocks accidental close and double submit while configured busy', () => {
    const provider = read('src/components/offcanvas/OffcanvasProvider.tsx');
    const confirmation = read('src/components/offcanvas/ConfirmOffcanvas.tsx');
    const footer = read('src/components/offcanvas/DrawerFormFooter.tsx');
    assert.match(provider, /primary\.preventCloseWhileBusy && primary\.isBusy/);
    assert.match(provider, /confirmation\.preventCloseWhileBusy && confirmation\.isBusy/);
    assert.match(footer, /disabled=\{isSubmitting \|\| isDisabled\}/);
    assert.match(confirmation, /setPending\(true\);\s*onBusyChange\(true\)/);
    assert.match(confirmation, /onBusyChange\(false\);\s*setPending\(false\)/);
    assert.doesNotMatch(confirmation, /useEffect\([\s\S]*?onBusyChange\(busy\)/);
  });

  it('uses one centralized keyboard listener and traps focus in the top panel', () => {
    const provider = read('src/components/offcanvas/OffcanvasProvider.tsx');
    assert.equal((provider.match(/document\.addEventListener\('keydown'/g) ?? []).length, 1);
    assert.equal((provider.match(/document\.removeEventListener\('keydown'/g) ?? []).length, 1);
    assert.match(provider, /requestCloseTop\('escape'\)/);
    assert.match(provider, /trapTabKey\(event, panel\)/);
  });

  it('implements focus entry and return without an external focus library', () => {
    const focus = read('src/utils/focusManagement.ts');
    const provider = read('src/components/offcanvas/OffcanvasProvider.tsx');
    assert.match(focus, /button:not\(\[disabled\]\)/);
    assert.match(focus, /autoFocusTarget\.focus\(\)/);
    assert.match(focus, /event\.shiftKey/);
    assert.match(focus, /restoreFocus/);
    assert.match(provider, /focusFirstElement\(panel, preferred\)/);
    assert.match(provider, /focusedEntries\.current\.has\(topEntry\.id\)/);
  });

  it('uses reference-counted body scroll owners shared with the mobile sidebar', () => {
    const scrollLock = read('src/utils/bodyScrollLock.ts');
    const layout = read('src/layouts/workspace/WorkspaceLayout.tsx');
    const provider = read('src/components/offcanvas/OffcanvasProvider.tsx');
    assert.match(scrollLock, /new Set<string>\(\)/);
    assert.match(scrollLock, /owners\.size > 0/);
    assert.match(layout, /useBodyScrollLock\(isMobileSidebarOpen, "mobile-sidebar"\)/);
    assert.match(provider, /'offcanvas-stack'/);
  });

  it('provides responsive 100dvh layout with independent body and sticky actions', () => {
    const offcanvas = read('src/components/offcanvas/Offcanvas.tsx');
    assert.match(offcanvas, /h-screen h-dvh w-screen w-\[100dvw\]/);
    assert.match(offcanvas, /md:w-\[65vw\]/);
    assert.match(offcanvas, /xl:w-\[35rem\]/);
    assert.match(offcanvas, /min-h-0 flex-1 overflow-x-hidden overflow-y-auto/);
    assert.match(offcanvas, /sticky top-0/);
    assert.match(offcanvas, /sticky bottom-0/);
  });

  it('animates transform and backdrop opacity and honors reduced motion', () => {
    const css = read('src/index.css');
    assert.match(css, /\.offcanvas-panel[\s\S]*?translate3d\(100%, 0, 0\)/);
    assert.match(css, /\.offcanvas-panel\[data-state="open"\][\s\S]*?translate3d\(0, 0, 0\)/);
    assert.match(css, /prefers-reduced-motion:[\s\S]*?\.offcanvas-backdrop,[\s\S]*?\.offcanvas-panel/);
    assert.doesNotMatch(css, /offcanvas-panel[^{]*\{[^}]*transition:\s*width/);
  });

  it('keeps legacy modal primitives and defines semantic application layers', () => {
    const crud = read('src/components/crud/CrudPrimitives.tsx');
    const layers = read('src/constants/layers.ts');
    assert.match(crud, /export const CrudModal/);
    assert.match(crud, /export const ConfirmDialog/);
    for (const value of [80, 81, 90, 91, 100, 200]) {
      assert.match(layers, new RegExp(`: ${value}`));
    }
  });
});
