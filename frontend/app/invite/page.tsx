import { Suspense } from 'react';
import { InviteView } from '@/components/invite/invite-view';

// useSearchParams（?token= を読む）は、静的書き出しでは Suspense で包む必要がある
export default function InvitePage() {
  return (
    <Suspense>
      <InviteView />
    </Suspense>
  );
}
