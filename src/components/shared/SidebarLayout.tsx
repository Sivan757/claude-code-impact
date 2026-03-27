import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SidebarLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
  mainClassName?: string;
}

export function SidebarLayout({ sidebar, children, className, mainClassName }: SidebarLayoutProps) {
  return (
    <div className={cn("flex h-full", className)}>
      {sidebar}
      <main className={cn("flex-1 min-w-0 overflow-auto", mainClassName)}>
        {children}
      </main>
    </div>
  );
}
