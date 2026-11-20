'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// パスワード欄（A01-5）。目のボタンで文字を見せる・隠すを切り替える。確認用の2つ目の欄は置かない（入力が増えるため）
export function PasswordField({
  label,
  autoComplete,
  minLength,
}: {
  label: string;
  autoComplete: 'current-password' | 'new-password';
  minLength?: number;
}) {
  const [shown, setShown] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-extrabold" htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          className="h-12 pr-12 text-base"
          id={id}
          name="password"
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          minLength={minLength}
        />
        <button
          type="button"
          aria-label={shown ? '文字を隠す' : '文字を表示'}
          aria-pressed={shown}
          onClick={() => setShown((v) => !v)}
          className="absolute top-0 right-0 flex size-12 items-center justify-center rounded-lg text-brand outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          {shown ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
        </button>
      </div>
    </div>
  );
}
