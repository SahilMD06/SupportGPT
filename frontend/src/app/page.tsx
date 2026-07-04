'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    router.replace(user ? '/chat' : '/auth/login');
  }, [user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="flex items-center gap-2.5">
        <div className="w-5 h-5 rounded-md animate-pulse" style={{ background: 'var(--accent-600)' }} />
        <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</span>
      </div>
    </div>
  );
}
