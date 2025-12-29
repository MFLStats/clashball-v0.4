import React from "react";
import { cn } from "@/lib/utils";
type AppLayoutProps = {
  children: React.ReactNode;
  container?: boolean;
  className?: string;
  contentClassName?: string;
};
export function AppLayout({ children, container = false, className, contentClassName }: AppLayoutProps): JSX.Element {
  return (
    <div className={cn("min-h-screen bg-slate-950 text-foreground", className)}>
      {container ? (
        <div className={cn(
          "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 lg:py-12",
          contentClassName
        )}>
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}