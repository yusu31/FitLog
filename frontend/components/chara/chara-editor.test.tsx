import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calls, installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { CharaEditor, CharaPage } from './chara-editor';

vi.mock('@/lib/use-require-session', () => ({ useRequireSession: () => ({ signedIn: true }) }));

const MINE = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy', accessory: 'none' } as const;
const layerNames = () => [...screen.getByTestId('chara').querySelectorAll('[data-layer]')].map((e) => e.getAttribute('data-layer')!.split('/').pop());

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => vi.unstubAllGlobals());

describe('キャラ編集（F-32）', () => {
  it('開くと、いまのキャラが見本に出て、6つのタブが並ぶ（最初は体型）', async () => {
    installFakeApi({ '/api/avatar': { status: 200, body: MINE } });
    renderWithQuery(<CharaPage />);
    expect(await screen.findByTestId('chara')).toBeInTheDocument();
    expect(layerNames()).toContain('hair-1-brown.png');
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['体型', '髪', '服', 'ズボン', '小物', 'ポーズ']);
    expect(screen.getByRole('tab', { name: '体型' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('radio', { name: 'タイプA' })).toHaveAttribute('aria-checked', 'true');
  });

  it('色の丸を選ぶと、見本がすぐ変わる（保存はまだ送らない）', async () => {
    installFakeApi({ '/api/avatar': { status: 200, body: MINE } });
    renderWithQuery(<CharaPage />);
    await screen.findByTestId('chara');
    await userEvent.click(screen.getByRole('tab', { name: '服' }));
    await userEvent.click(screen.getByRole('radio', { name: 'コーラル' }));
    expect(layerNames()).toContain('shirt-A-coral.png');
    expect(screen.getByRole('radio', { name: 'コーラル' })).toHaveAttribute('aria-checked', 'true');
    expect(calls.filter((c) => c.startsWith('PUT'))).toEqual([]);
  });

  it('髪型・髪の色・小物・体型・ズボンを選ぶと、そのまま PUT /avatar に送る', async () => {
    installFakeApi({
      '/api/avatar': [
        { status: 200, body: MINE },
        { status: 200, body: { ...MINE, body: 'B', hair: 3, hairColor: 'blonde', pantsColor: 'khaki', accessory: 'glasses' } },
      ],
      'PUT /api/avatar': { status: 200, body: { ...MINE, body: 'B', hair: 3, hairColor: 'blonde', pantsColor: 'khaki', accessory: 'glasses' } },
    });
    renderWithQuery(<CharaPage />);
    await screen.findByTestId('chara');
    await userEvent.click(screen.getByRole('radio', { name: 'タイプB' }));
    await userEvent.click(screen.getByRole('tab', { name: '髪' }));
    await userEvent.click(screen.getByRole('radio', { name: '流し前髪' }));
    await userEvent.click(screen.getByRole('radio', { name: 'ブロンド' }));
    await userEvent.click(screen.getByRole('tab', { name: 'ズボン' }));
    await userEvent.click(screen.getByRole('radio', { name: 'カーキ' }));
    await userEvent.click(screen.getByRole('tab', { name: '小物' }));
    await userEvent.click(screen.getByRole('radio', { name: 'メガネ' }));
    await userEvent.click(screen.getByRole('button', { name: '保存する' }));
    expect(await screen.findByRole('status')).toHaveTextContent('保存しました');
    const put = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PUT')!;
    expect(JSON.parse(put[1]!.body as string)).toEqual({ body: 'B', hair: 3, hairColor: 'blonde', shirtColor: 'teal', pantsColor: 'khaki', accessory: 'glasses' });
  });

  it('保存を断られたら、サーバーの日本語の言葉を出す。通信が切れたら決まった言葉を出す（どちらも再試行できる）', async () => {
    installFakeApi({ 'PUT /api/avatar': { status: 400, body: { code: 'VALIDATION_ERROR', message: '入力が正しくありません' } } });
    renderWithQuery(<CharaEditor initial={MINE} />);
    await userEvent.click(screen.getByRole('button', { name: '保存する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('入力が正しくありません');
    expect(screen.getByRole('button', { name: '保存する' })).toBeEnabled();

    installFakeApi({}); // 何も答えない（通信の失敗）
    await userEvent.click(screen.getByRole('button', { name: '保存する' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('保存できませんでした'));
    expect(screen.getByRole('button', { name: '保存する' })).toBeEnabled();
  });

  it('タブは左右の矢印キーで移れる（端は反対側へ回る）', async () => {
    renderWithQuery(<CharaEditor initial={MINE} />);
    screen.getByRole('tab', { name: '体型' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: '髪' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '髪' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'ポーズ' })).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByRole('tabpanel')).getByRole('radio', { name: '待機' })).toBeInTheDocument();
  });

  it('ポーズは見るだけ: 選ぶと見本のポーズが変わり、保存の中身には入らない', async () => {
    installFakeApi({ 'PUT /api/avatar': { status: 200, body: MINE }, '/api/avatar': { status: 200, body: MINE } });
    renderWithQuery(<CharaEditor initial={MINE} />);
    await userEvent.click(screen.getByRole('tab', { name: 'ポーズ' }));
    await userEvent.click(screen.getByRole('radio', { name: 'ラン' }));
    expect(screen.getByTestId('chara')).toHaveAttribute('data-pose', 'run');
    await userEvent.click(screen.getByRole('button', { name: '保存する' }));
    await waitFor(() => expect(calls.some((c) => c.startsWith('PUT'))).toBe(true));
    const put = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PUT')!;
    expect(Object.keys(JSON.parse(put[1]!.body as string)).sort()).toEqual(['accessory', 'body', 'hair', 'hairColor', 'pantsColor', 'shirtColor']);
  });

  it('読み込みに失敗したら、決まった言葉を出す', async () => {
    installFakeApi({ '/api/avatar': { status: 500, body: { code: 'INTERNAL', message: 'x' } } });
    renderWithQuery(<CharaPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('読み込めませんでした');
  });
});
