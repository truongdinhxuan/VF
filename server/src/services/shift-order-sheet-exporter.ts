import ExcelJS from 'exceljs';

export const SHIFT_ORDER_SHEET_EXPORT_HEADERS = [
  'Mã hàng',
  'Tên mã',
  'Số lượng',
  'Số chồng',
  'Nhà cung cấp',
  'Giờ order',
  'Giờ nhận hàng',
  'Note',
] as const;

export const SHIFT_ORDER_SHEET_WORKSHEET_NAME = 'Phiếu Order Ca';
export const SHIFT_ORDER_SHEET_EXPORT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export interface ShiftOrderSheetExportItem {
  id: string;
  created_at: string;
  quantity_requested: number | string;
  quantity_issued: number | string | null;
  set_per_qty: number | string | null;
  requested_stack_quantity: number | string | null;
  note: string | null;
  supply: {
    code: string;
    description: string | null;
    category: { code: string } | null;
  } | null;
  provider: { code: string; name: string } | null;
}

export interface ShiftOrderSheetExportOrder {
  id: string;
  code: string;
  submitted_at: string | null;
  issued_at: string | null;
  note: string | null;
  is_deleted: boolean;
  order_items: ShiftOrderSheetExportItem[];
}

export interface ShiftOrderSheetExportSource {
  id: string;
  work_date: string;
  area: { code: string; name: string } | null;
  work_shift: { code: string; name: string } | null;
  orders: ShiftOrderSheetExportOrder[];
}

export interface ShiftOrderSheetExportRow {
  supplyCode: string;
  supplyName: string;
  quantity: number;
  stackQuantity: number | null;
  provider: string;
  orderedTime: string;
  issuedTime: string;
  note: string;
}

export class ShiftOrderSheetExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShiftOrderSheetExportError';
  }
}

const toNumber = (value: number | string | null, field: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ShiftOrderSheetExportError(`Dữ liệu ${field} không hợp lệ để xuất Excel`);
  }
  return parsed;
};

export const formatBusinessTime = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: SHIFT_ORDER_SHEET_EXPORT_TIME_ZONE,
  }).format(date);
};

const resolveQuantity = (item: ShiftOrderSheetExportItem): number => {
  const issued = toNumber(item.quantity_issued ?? 0, 'quantity_issued');
  return issued > 0
    ? issued
    : toNumber(item.quantity_requested, 'quantity_requested');
};

const resolveStackQuantity = (
  item: ShiftOrderSheetExportItem,
  categoryCode: string,
): number | null => {
  if (categoryCode !== 'KIEN_SAT_TC') return null;

  const requested = toNumber(item.quantity_requested, 'quantity_requested');
  const issued = toNumber(item.quantity_issued ?? 0, 'quantity_issued');
  if (issued > 0 && issued < requested) {
    throw new ShiftOrderSheetExportError(
      `OrderItem ${item.id} KIEN_SAT_TC có dữ liệu issue một phần chưa được hỗ trợ`,
    );
  }

  if (issued > 0) {
    const setPerQty = toNumber(item.set_per_qty, 'set_per_qty');
    if (setPerQty <= 0) {
      throw new ShiftOrderSheetExportError(
        `OrderItem ${item.id} thiếu set_per_qty để tính số chồng đã cấp`,
      );
    }
    const stackQuantity = issued / setPerQty;
    if (Math.abs(stackQuantity - Math.round(stackQuantity)) > 1e-9) {
      throw new ShiftOrderSheetExportError(
        `OrderItem ${item.id} có quantity_issued không tương thích set_per_qty`,
      );
    }
    return stackQuantity;
  }

  if (item.requested_stack_quantity === null) {
    throw new ShiftOrderSheetExportError(
      `OrderItem ${item.id} thiếu requested_stack_quantity`,
    );
  }
  return toNumber(item.requested_stack_quantity, 'requested_stack_quantity');
};

const firstNonBlank = (...values: Array<string | null>): string => {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) return normalized;
  }
  return '';
};

export const buildShiftOrderSheetExportRows = (
  source: ShiftOrderSheetExportSource,
): ShiftOrderSheetExportRow[] => source.orders
  .filter((order) => !order.is_deleted)
  .flatMap((order) => order.order_items.map((item) => ({ order, item })))
  .sort((left, right) => (
    (left.order.submitted_at ?? '').localeCompare(right.order.submitted_at ?? '')
    || left.order.code.localeCompare(right.order.code)
    || left.item.created_at.localeCompare(right.item.created_at)
    || left.item.id.localeCompare(right.item.id)
  ))
  .map(({ order, item }) => {
    const categoryCode = item.supply?.category?.code ?? '';
    return {
      supplyCode: item.supply?.code ?? '',
      supplyName: item.supply?.description?.trim() ?? '',
      quantity: resolveQuantity(item),
      stackQuantity: resolveStackQuantity(item, categoryCode),
      provider: item.provider
        ? `${item.provider.code} — ${item.provider.name}`
        : '',
      orderedTime: formatBusinessTime(order.submitted_at),
      issuedTime: formatBusinessTime(order.issued_at),
      note: firstNonBlank(item.note, order.note),
    };
  });

const sanitizeFilenameSegment = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9_-]+/g, '_')
  .replace(/^_+|_+$/g, '')
  || 'NA';

export const createShiftOrderSheetExportFilename = (
  source: ShiftOrderSheetExportSource,
): string => [
  'Phieu_Order_Ca',
  sanitizeFilenameSegment(source.area?.code ?? 'AREA'),
  sanitizeFilenameSegment(source.work_shift?.code ?? 'SHIFT'),
  sanitizeFilenameSegment(source.work_date),
].join('_').concat('.xlsx');

export const createShiftOrderSheetWorkbook = async (
  source: ShiftOrderSheetExportSource,
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VF Supply';
  workbook.created = new Date(0);
  workbook.modified = new Date(0);

  const worksheet = workbook.addWorksheet(SHIFT_ORDER_SHEET_WORKSHEET_NAME);
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = 'A1:H1';
  worksheet.columns = [
    { key: 'supplyCode', width: 18 },
    { key: 'supplyName', width: 36 },
    { key: 'quantity', width: 14 },
    { key: 'stackQuantity', width: 14 },
    { key: 'provider', width: 30 },
    { key: 'orderedTime', width: 16 },
    { key: 'issuedTime', width: 18 },
    { key: 'note', width: 36 },
  ];
  worksheet.addRow([...SHIFT_ORDER_SHEET_EXPORT_HEADERS]);

  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' },
  };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  header.height = 24;

  for (const row of buildShiftOrderSheetExportRows(source)) {
    worksheet.addRow({
      ...row,
      supplyCode: row.supplyCode || null,
      supplyName: row.supplyName || null,
      stackQuantity: row.stackQuantity ?? null,
      provider: row.provider || null,
      orderedTime: row.orderedTime || null,
      issuedTime: row.issuedTime || null,
      note: row.note || null,
    });
  }

  worksheet.getColumn('quantity').numFmt = '0.########';
  worksheet.getColumn('stackQuantity').numFmt = '0.########';
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.alignment = { vertical: 'top', wrapText: true };
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
};
