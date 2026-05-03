import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock do Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock do ThemeProvider
vi.mock('@/components/ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    toggle: vi.fn(),
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock do resize observer (usado pelo Recharts)
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;
