import { createContext } from 'react';
import type { OffcanvasContextValue } from '../../types/offcanvas.types';

export const OffcanvasContext = createContext<OffcanvasContextValue | null>(null);

