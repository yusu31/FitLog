"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Dumbbell, Footprints, Moon } from "lucide-react";
import { setFilmFirst } from "@/lib/film-first";
import { canRecordVideo } from "@/components/record/video-recorder";
import { ThickButton } from "./thick-button";
import { Sprite } from "./sprite";

const noSubscribe = () => () => {};

// 英語の操作語は見た目だけ。aria-label に今の日本語を入れて、読み上げと E2E の getByRole(name) を変えない
const ACTIONS = [
  {
    href: "/exercises",
    word: "STRENGTH",
    label: "筋トレを記録",
    Icon: Dumbbell,
    film: true,
  },
  {
    href: "/run",
    word: "RUN",
    label: "ランを記録",
    Icon: Footprints,
    film: false,
  },
  {
    href: "/rest",
    word: "REST",
    label: "おやすみにする",
    Icon: Moon,
    film: false,
  },
] as const;

// 中央の＋で開く、下からのシート。キャラの一言と、行き先3つ（筋トレ・ラン・おやすみ）
export function StartSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [film, setFilm] = useState(false);
  const videoCapable = useSyncExternalStore(
    noSubscribe,
    canRecordVideo,
    () => false,
  );

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-night/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] space-y-4 rounded-t-3xl bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-end gap-3">
          <Sprite pose="ready" size={72} />
          <div className="rounded-2xl bg-teal-light px-4 py-3">
            <h2 id={titleId} className="text-base font-extrabold text-brand">
              始めるぞー！
            </h2>
            {videoCapable && (
              <p className="text-note font-bold text-fg-muted">
                最初の2秒、撮っておく？
              </p>
            )}
          </div>
        </div>
        {videoCapable && (
          <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
            <input
              type="checkbox"
              checked={film}
              onChange={(e) => setFilm(e.target.checked)}
              className="size-5 accent-[var(--color-teal-dark)]"
            />
            2秒動画を撮る（最初の1セットのあと）
          </label>
        )}
        <ul className="space-y-2">
          {ACTIONS.map(({ href, word, label, Icon, film: usesFilm }) => (
            <li key={href}>
              <Link
                href={href}
                aria-label={label}
                onClick={() => {
                  setFilmFirst(usesFilm && videoCapable && film);
                  onClose();
                }}
                className="fl-thick inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-fl bg-teal-dark text-lg font-extrabold tracking-wider text-white outline-none [--thick:var(--color-teal-deep)] focus-visible:ring-4 focus-visible:ring-teal/40"
              >
                <Icon aria-hidden className="size-5" />
                {word}
              </Link>
            </li>
          ))}
        </ul>
        <ThickButton
          ref={closeRef}
          variant="link"
          className="w-full"
          aria-label="閉じる"
          onClick={onClose}
        >
          CLOSE
        </ThickButton>
      </div>
    </div>
  );
}
