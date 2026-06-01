'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { MobileSidebar } from '@/components/mobile-sidebar';
import { MobileNav } from '@/components/mobile-nav';
import { Header } from '@/components/header';
import { OfflineIndicator } from '@/components/offline-indicator';
import { ImageLightbox } from '@/components/image-lightbox';
import { LightboxProvider } from '@/lib/lightbox-context';
import { useAuth } from '@/lib/hooks/use-auth';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { user, isAuthenticated, isLoading, error } = useAuth();

  useEffect(() => {
    // If auth check completed and user is not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Check onboarding status from API user
  useEffect(() => {
    if (user && user.onboarding_completed === false) {
      router.push('/onboarding');
    }
  }, [user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">正在加载衣橱...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <LightboxProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:pl-72">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="px-3 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:pb-6 overflow-x-hidden">
            {children}
          </main>
        </div>
        <MobileNav />
        <OfflineIndicator />
        <ImageLightbox />
      </div>
    </LightboxProvider>
  );
}
