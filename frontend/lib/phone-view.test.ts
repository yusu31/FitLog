import { readPhoneView, setPhoneView } from './phone-view';
import { PHONE_VIEW_BOOT_SCRIPT, PHONE_VIEW_KEY } from './phone-view-boot';

describe('phone-view', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.view;
  });

  it('既定は PC 表示（保存なし）', () => {
    expect(readPhoneView()).toBe(false);
  });

  it('スマホ表示にすると、端末に覚え、<html> に data-view=phone が付く', () => {
    setPhoneView(true);
    expect(localStorage.getItem(PHONE_VIEW_KEY)).toBe('1');
    expect(readPhoneView()).toBe(true);
    expect(document.documentElement.dataset.view).toBe('phone');
  });

  it('PC 表示に戻すと、保存も data-view も消える', () => {
    setPhoneView(true);
    setPhoneView(false);
    expect(localStorage.getItem(PHONE_VIEW_KEY)).toBeNull();
    expect(readPhoneView()).toBe(false);
    expect(document.documentElement.dataset.view).toBeUndefined();
  });

  it('先読みスクリプトは、保存キーと data-view の付与を含み、実行すると反映される', () => {
    expect(PHONE_VIEW_BOOT_SCRIPT).toContain(PHONE_VIEW_KEY);
    localStorage.setItem(PHONE_VIEW_KEY, '1');
    new Function(PHONE_VIEW_BOOT_SCRIPT)();
    expect(document.documentElement.dataset.view).toBe('phone');
  });
});
