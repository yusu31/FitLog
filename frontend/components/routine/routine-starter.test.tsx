import { act, screen, waitFor } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { getCopyPlan, resetCopyPlan } from '@/lib/copy-plan';
import { calls, installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { RoutineStarter } from './routine-starter';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const ROUTINES = '/api/routines';
const ok = (body: unknown) => ({ status: 200, body });
const LEG = {
  id: 'rt1',
  name: '脚の日',
  createdAt: '2026-11-17T03:00:00.000Z',
  exercises: [
    { exerciseId: 'sq', name: 'スクワット', bodyPart: 'legs', sets: [{ setNo: 1, weightKg: 60, reps: 10 }, { setNo: 2, weightKg: 60, reps: 8 }] },
    { exerciseId: 'lc', name: 'レッグカール', bodyPart: 'legs', sets: [{ setNo: 1, weightKg: 25, reps: 12 }] },
  ],
};

beforeEach(() => {
  push.mockClear();
  resetCopyPlan();
});
afterEach(() => {
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
});

describe('RoutineStarter（今日の画面の「いつものメニューから始める」。F3）', () => {
  it('保存したいつものメニューが無ければ何も出さない', async () => {
    installFakeApi({ [ROUTINES]: ok({ items: [], max: 5 }) });
    const { container } = renderWithQuery(<RoutineStarter day="today" />);
    await waitFor(() => expect(calls).toContain(`GET ${ROUTINES}`));
    expect(container).toBeEmptyDOMElement();
  });

  it('名前と種目の並びが出る。押すと「やる予定」を渡して最初の種目の記録画面へ。コピー元は付けない', async () => {
    installFakeApi({ [ROUTINES]: ok({ items: [LEG], max: 5 }) });
    renderWithQuery(<RoutineStarter day="today" />);
    expect(await screen.findByText('スクワット・レッグカール')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '脚の日を始める' }));
    expect(push).toHaveBeenCalledWith('/record?exercise=sq&plan=1');
    expect(getCopyPlan()).toMatchObject({
      fromUserId: null,
      routineName: '脚の日',
      used: false,
      items: [
        { exerciseId: 'sq', name: 'スクワット', sets: [{ weightKg: 60, reps: 10 }, { weightKg: 60, reps: 8 }] },
        { exerciseId: 'lc', name: 'レッグカール', sets: [{ weightKg: 25, reps: 12 }] },
      ],
    });
    // 始めただけでは記録を作らない
    expect(calls.filter((c) => c.startsWith('POST'))).toHaveLength(0);
  });

  it('きのうの分（F-21）では day=yesterday を付けて移る', async () => {
    installFakeApi({ [ROUTINES]: ok({ items: [LEG], max: 5 }) });
    renderWithQuery(<RoutineStarter day="yesterday" />);
    await userEvent.click(await screen.findByRole('button', { name: '脚の日を始める' }));
    expect(push).toHaveBeenCalledWith('/record?exercise=sq&plan=1&day=yesterday');
  });

  it('×で確認してから消し、一覧を読み直す', async () => {
    installFakeApi({ [ROUTINES]: [ok({ items: [LEG], max: 5 }), ok({ items: [], max: 5 })], 'DELETE /api/routines/rt1': { status: 204 } });
    renderWithQuery(<RoutineStarter day="today" />);
    await userEvent.click(await screen.findByRole('button', { name: '脚の日を消す' }));
    expect(await screen.findByText('「脚の日」を消します。これまでの記録は消えません。')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '消す' }));
    await waitFor(() => expect(calls).toContain('DELETE /api/routines/rt1'));
    await waitFor(() => expect(screen.queryByRole('button', { name: '脚の日を始める' })).not.toBeInTheDocument());
  });

  it('電波が無いときは消せない（始めるのは端末の中だけなので押せる）', async () => {
    installFakeApi({ [ROUTINES]: ok({ items: [LEG], max: 5 }) });
    renderWithQuery(<RoutineStarter day="today" />);
    const remove = await screen.findByRole('button', { name: '脚の日を消す' });
    act(() => onlineManager.setOnline(false));
    await waitFor(() => expect(remove).toBeDisabled());
    expect(screen.getByRole('button', { name: '脚の日を始める' })).toBeEnabled();
  });
});
