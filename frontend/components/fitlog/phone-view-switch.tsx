'use client';

import { Monitor, Smartphone } from 'lucide-react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { PHONE_VIEW_MESSAGES } from '@/lib/messages';
import { setPhoneView, usePhoneView } from '@/lib/phone-view';

// 「PC 画面／スマホと同じ画面」の切替ボタン（02-9 ⑪）。PC 幅（1024px 以上）のときだけ、画面の右上に浮かせる。
// 幅が足りない端末では出さない。ここは pc: でなく素の幅指定（スマホ表示中でも、ここから PC 表示へ戻せるように）
export function PhoneViewSwitch() {
  const phone = usePhoneView();
  const Icon = phone ? Monitor : Smartphone;
  const label = phone ? PHONE_VIEW_MESSAGES.toPc : PHONE_VIEW_MESSAGES.toPhone;
  return (
    <ThickButton
      tone="white"
      size="sm"
      aria-pressed={phone}
      aria-label={PHONE_VIEW_MESSAGES.ariaLabel(phone)}
      className="fixed top-3 right-4 z-30 hidden min-[1024px]:inline-flex"
      onClick={() => setPhoneView(!phone)}
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </ThickButton>
  );
}
