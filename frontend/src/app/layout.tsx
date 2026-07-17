import type { Metadata } from 'next';
import '../styles/globals.css';
import { ThemeProvider } from '@/lib/theme';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'NovaTech Solutions | SupportGPT',
  description: 'SupportGPT — AI-powered customer support for NovaTech Solutions smart home devices and electronics',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              const t = localStorage.getItem('theme') || 'system';
              const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
              if (dark) document.documentElement.classList.add('dark');
            } catch(e) {}
          `
        }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                fontSize: '13px',
                fontFamily: 'Inter, sans-serif',
                borderRadius: '10px',
                padding: '12px 16px',
                background: 'var(--bg-overlay)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-lg)',
              },
              success: {
                iconTheme: { primary: '#16A34A', secondary: 'white' },
              },
              error: {
                iconTheme: { primary: '#DC2626', secondary: 'white' },
                duration: 5000,
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
