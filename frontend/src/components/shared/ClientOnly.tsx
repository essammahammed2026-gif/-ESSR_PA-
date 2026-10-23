"use client";

import React, { useEffect, useState, ReactNode } from "react";

export interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * ClientOnly wrapper component.
 * Prevents hydration mismatches by ensuring children are only rendered after mounting on the client.
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default ClientOnly;
