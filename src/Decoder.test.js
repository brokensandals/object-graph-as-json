import { builtins } from './builtins';
import { Encoder } from './Encoder';
import { Decoder } from './Decoder';

describe('Decoder', () => {
  let encoder;
  let decoder;

  function encdec(value) {
    return decoder.decode(encoder.encode(value));
  }

  beforeEach(() => {
    encoder = new Encoder();
    decoder = new Decoder();
    decoder.onFailure = (value, message) => ({ value, failure: message });
  });

  describe('values that encode to themselves', () => {
    const values = [null, false, true, 0, -100, 200, 10.5, '', 'hello'];

    for (const value of values) {
      test(`${value} decodes correctly`, () => {
        expect(encdec(value)).toEqual(value);
      })
    }
  });

  describe('builtins', () => {
    for (const [obj, key] of builtins) {
      test(`${key}`, () => {
        expect(encdec(obj)).toBe(obj);
      });
    }

    test('no name', () => {
      const input = { type: 'builtin' };
      expect(decoder.decode(input)).toEqual({
        value: input,
        failure: 'builtin is missing name',
      });
    });

    test('unknown name', () => {
      const input = { type: 'builtin', name: 'garbage' };
      expect(decoder.decode(input)).toEqual({
        value: input,
        failure: 'unrecognized builtin name [garbage]',
      });
    });
  });
});
