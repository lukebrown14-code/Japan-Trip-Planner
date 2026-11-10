import type { ApiClient } from '@shared/api';
import { mockApi } from './api.mock';
// VITE_API=real (production build) uses the server through api.real.ts (Collaboration agent). Dev default = mock.
import { realApi } from './api.real';
export const api: ApiClient = import.meta.env.VITE_API === 'real' ? realApi : mockApi;
