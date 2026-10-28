import { ArgumentsHost, BadRequestException, HttpStatus, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { errorCode } from './error-code.js';

// drizzle が DB のエラーを包んだときの形（実物）: message に SQL の引数が入り、本当の原因は cause.code にある
const drizzleLikeError = () => {
  const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), { code: 'ECONNREFUSED' });
  return new Error('Failed query: select $1::text\nparams: tok_SECRET_VALUE', { cause });
};

const makeHost = () => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('errorCode', () => {
  // T-ERR-01: ネットワークの Error は code を持つ
  it('Error の code を返す', () => {
    expect(errorCode(Object.assign(new Error('x'), { code: 'ECONNRESET' }))).toBe('ECONNRESET');
  });
  // T-ERR-02: drizzle は包むので、本当の原因は cause.code にある
  it('code が無ければ cause.code を返す', () => {
    expect(errorCode(drizzleLikeError())).toBe('ECONNREFUSED');
  });
  // T-ERR-03: どちらも無ければ unknown
  it('どちらも無ければ unknown', () => {
    expect(errorCode(new Error('x'))).toBe('unknown');
    expect(errorCode('文字列')).toBe('unknown');
  });
});

describe('AllExceptionsFilter', () => {
  afterEach(() => vi.restoreAllMocks());

  // T-ERR-04: 想定外のエラー。SQL の引数（秘密になりうる値）をログにも応答にも出さない
  it('想定外のエラーは 500 の決まった形で返し、ログに SQL の引数を出さない', () => {
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = makeHost();

    new AllExceptionsFilter().catch(drizzleLikeError(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      code: 'INTERNAL_ERROR',
      message: 'サーバーでエラーが起きました',
      details: null,
    });
    const logged = JSON.stringify(errorLog.mock.calls);
    expect(logged).not.toContain('tok_SECRET_VALUE');
    expect(logged).toContain('ECONNREFUSED'); // 本当の原因は残す
  });

  // T-ERR-05: 設計の形（code・message・details）に揃った HttpException はそのまま返す
  it('code を持つ HttpException はそのままの形で返す', () => {
    const { host, status, json } = makeHost();
    const body = { code: 'DB_UNAVAILABLE', message: 'データベースに接続できません', details: null };
    new AllExceptionsFilter().catch(new BadRequestException(body), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(body);
  });

  // T-ERR-06: Nest 既定の形（statusCode・message）の HttpException は、設計の形に直す
  it('Nest 既定の形の HttpException は code・message・details の形に直す', () => {
    const { host, status, json } = makeHost();
    new AllExceptionsFilter().catch(new BadRequestException('入力が正しくありません'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      code: 'BAD_REQUEST',
      message: '入力が正しくありません',
      details: null,
    });
  });
});
