import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { ExportRecords } from './export-records';

const createObjectURL = vi.fn(() => 'blob:fake');
const revokeObjectURL = vi.fn();
let clicked: { download: string; href: string }[] = [];

beforeEach(() => {
  clicked = [];
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ download: this.download, href: this.href });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const csvReply = (status: number, body = 'a,b\r\n1,2\r\n') =>
  vi.fn(async () => new Response(body, { status, headers: { 'Content-Type': 'text/csv; charset=utf-8' } }));

describe('ExportRecords（C-01 記録の書き出し）', () => {
  it('「記録を書き出す（CSV）」ボタンと、表計算ソフトで開けるという補足を出す', () => {
    render(<ExportRecords />);
    expect(screen.getByRole('button', { name: /記録を書き出す（CSV）/ })).toBeEnabled();
    expect(screen.getByText(/表計算ソフトで開けます/)).toBeInTheDocument();
  });

  it('押すと API を呼び、CSV をファイルとして保存する（Excel 用に先頭へ BOM を付け直す）', async () => {
    const fetchMock = csvReply(200);
    vi.stubGlobal('fetch', fetchMock);
    render(<ExportRecords />);
    await userEvent.click(screen.getByRole('button', { name: /記録を書き出す（CSV）/ }));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect((fetchMock.mock.calls as unknown as string[][])[0]![0]).toBe('/api/me/export.csv');
    expect(clicked[0]!.download).toBe('fitlog-records.csv');
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toContain('text/csv');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('a,b\r\n1,2\r\n');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('保存中は押せず、「書き出しています」と出る（二重押しの防止）', async () => {
    let release: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => (release = resolve))));
    render(<ExportRecords />);
    await userEvent.click(screen.getByRole('button', { name: /記録を書き出す（CSV）/ }));
    const busy = screen.getByRole('button', { name: /書き出しています/ });
    expect(busy).toBeDisabled();
    release(new Response('a\r\n', { status: 200 }));
    await waitFor(() => expect(screen.getByRole('button', { name: /記録を書き出す（CSV）/ })).toBeEnabled());
  });

  it('サーバーが失敗を返したら、責めない文言を出して、もう一度押せる', async () => {
    vi.stubGlobal('fetch', csvReply(500, ''));
    render(<ExportRecords />);
    await userEvent.click(screen.getByRole('button', { name: /記録を書き出す（CSV）/ }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('書き出せませんでした');
    for (const word of FORBIDDEN_WORDS) expect(alert.textContent).not.toContain(word);
    expect(clicked).toHaveLength(0);
    expect(screen.getByRole('button', { name: /記録を書き出す（CSV）/ })).toBeEnabled();
  });

  it('通信できないときも、分かる文言を出す', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    render(<ExportRecords />);
    await userEvent.click(screen.getByRole('button', { name: /記録を書き出す（CSV）/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('通信できませんでした');
  });
});
