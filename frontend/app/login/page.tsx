import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

// useSearchParams（?next= を読む）は、静的書き出しでは Suspense で包む必要がある
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
