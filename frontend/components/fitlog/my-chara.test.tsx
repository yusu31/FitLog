import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { MyChara } from './my-chara';

describe('MyChara（自分のキャラ・F-32）', () => {
  it('保存した見た目が読めたら、その見た目で組み立てる（髪 3・青いバンダナ）', async () => {
    installFakeApi({ '/api/avatar': { status: 200, body: { body: 'B', hair: 3, hairColor: 'red', shirtColor: 'navy', pantsColor: 'black', accessory: 'bandana' } } });
    renderWithQuery(<MyChara pose="idle" size={64} />);
    const chara = await screen.findByTestId('chara');
    expect(chara.innerHTML).toContain('bandana');
    expect(screen.queryByTestId('sprite')).toBeNull();
  });

  it('読めなかった（失敗した）ときは、既定と同じ1枚絵の Sprite を出す', async () => {
    installFakeApi({ '/api/avatar': { status: 500 } });
    renderWithQuery(<MyChara pose="idle" size={64} />);
    await waitFor(() => expect(screen.getByTestId('sprite')).toBeInTheDocument());
    expect(screen.queryByTestId('chara')).toBeNull();
  });
});
