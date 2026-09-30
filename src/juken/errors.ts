/** Kesalahan pada lapisan protokol/lalu lintas. Bebas dari API platform. */
export type JukenErrorKind =
  | 'unsupported'
  | 'unavailable'
  | 'notEnabled'
  | 'permission'
  | 'connectFailed'
  | 'io'
  | 'protocol';

export class JukenError extends Error {
  constructor(
    readonly kind: JukenErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'JukenError';
  }
}