import { Encoder } from './Encoder';

describe('Encoder', () => {
  let encoder;

  beforeEach(() => {
    encoder = new Encoder();
  });

  describe('values that encode to themselves', () => {
    const values = [null, false, true, 0, -100, 200, 10.5, '', 'hello'];

    for (const value of values) {
      test(`${value} encodes correctly`, () => {
        expect(encoder.encode(value)).toEqual(value);
      })
    }
  });

  describe('builtins', () => {
    const tests = [
      [NaN, 'NaN'],
      [Infinity, 'Infinity'],
      [undefined, 'undefined'],
    ];

    for (const [value, expected] of tests) {
      test(`${value} encodes correctly`, () => {
        expect(encoder.encode(value)).toEqual({ type: 'builtin', name: expected });
      });
    }
  });

  test('BigInts encode correctly', () => {
    expect(encoder.encode(BigInt('123456789012345678901234567890'))).toEqual({
      type: 'bigint',
      string: '123456789012345678901234567890',
    });
  });
});
