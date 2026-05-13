/** 知音楼 OAPI 业务错误，携带 `.code` 供调用方识别需重新鉴权等特殊错误码。*/
export class YachApiError extends Error {
  readonly code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = 'YachApiError';
    this.code = code;
  }
}

export function isYachApiError(err: unknown): err is YachApiError {
  return err instanceof YachApiError;
}
