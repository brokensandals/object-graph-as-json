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

  describe('bigints', () => {
    test('successful', () => {
      expect(encdec(BigInt('1234567890123456789012345678901234567890'))).toEqual(
        BigInt('1234567890123456789012345678901234567890'));
    });

    test('no string', () => {
      const input = { type: 'bigint' };
      expect(decoder.decode(input)).toEqual({
        value: input,
        failure: 'bigint is missing string',
      });
    });

    test('parse error', () => {
      const input = { type: 'bigint', string: 'forty-two' };
      expect(decoder.decode(input)).toEqual({
        value: input,
        failure: 'error parsing bigint [forty-two]: SyntaxError: Cannot convert forty-two to a BigInt',
      });
    });
  });

  describe('symbols', () => {
    test('successful', () => {
      const original = Symbol();
      const actual = encdec(original);
      expect(actual).not.toBe(original);
      expect(typeof actual).toEqual('symbol');
    });

    test('with description', () => {
      const original = Symbol('meep');
      const actual = encdec(original);
      expect(actual).not.toBe(original);
      expect(actual.description).toEqual('meep');
    });

    test('reuses symbols in idMap', () => {
      const original = Symbol();
      const encoded = encoder.encode(original);
      const idMap = new Map([[encoded.id, original]]);
      expect(decoder.decode(encoded, { idMap })).toBe(original);
    });

    test('updates idMap', () => {
      const original = Symbol();
      const encoded = encoder.encode(original);
      const idMap = new Map();
      const actual = decoder.decode(encoded, { idMap });
      expect(idMap.get(encoded.id)).toBe(actual);
    });

    // TODO: test that symbols get reused when the same id appears multiple times in the input

    test('no id', () => {
      const input = { type: 'symbol', description: 'foo'};
      expect(decoder.decode(input)).toEqual({
        value: input,
        failure: 'symbol is missing id',
      });
    });

    test('description conflict', () => {
      const original = Symbol('old');
      const encoded = encoder.encode(original);
      const idMap = new Map([[encoded.id, original]]);
      encoded.description = 'new';
      expect(decoder.decode(encoded, { idMap })).toEqual({
        value: encoded,
        failure: `symbol with id [${encoded.id}] has different description [new] than existing symbol with that id [old]`,
      });
    });
  });
});
