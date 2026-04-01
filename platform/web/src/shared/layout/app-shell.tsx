"use client";

import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </>
  );
}
