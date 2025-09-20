import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('axios', () => {
	return {
		default: {
			get: vi.fn(async () => ({ data: [] })),
			post: vi.fn(async () => ({ data: {} })),
			put: vi.fn(async () => ({ data: {} })),
			delete: vi.fn(async () => ({ data: {} })),
		},
	};
});
