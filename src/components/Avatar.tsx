import { useState } from 'react';
import type { User } from '@supabase/supabase-js';

export function Avatar({ user, name, large }: { user: User | null; name?: string; large?: boolean }) {
  const [broken, setBroken] = useState(false);
  const pic = user?.user_metadata?.avatar_url as string | undefined;
  const label = (name || (user?.user_metadata?.full_name as string) || user?.email || '?').trim();
  return (
    <span className={`avatar ${large ? 'lg' : ''}`}>
      {pic && !broken ? <img src={pic} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : label[0]?.toUpperCase()}
    </span>
  );
}
