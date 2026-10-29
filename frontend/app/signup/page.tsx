import { Suspense } from 'react';
import { SignupForm } from '@/components/auth/signup-form';

// useSearchParams（?next= を読む）は、静的書き出しでは Suspense で包む必要がある
export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
