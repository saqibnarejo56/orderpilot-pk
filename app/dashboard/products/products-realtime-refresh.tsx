'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ProductsRealtimeRefresh() {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('products-live-refresh')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        () => {
          window.location.reload();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
