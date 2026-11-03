export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, what);
export const badRequest = (msg: string) => new HttpError(400, msg);
export const unauthorized = () => new HttpError(401, 'Missing or invalid token');
export const forbidden = (msg = 'Forbidden') => new HttpError(403, msg);
