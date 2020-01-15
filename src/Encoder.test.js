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
      // Number-related
      [NaN, 'NaN'],
      [Infinity, 'Infinity'],

      // undefined
      [undefined, 'undefined'],
      
      // Well-known symbols - https://tc39.es/ecma262/#sec-well-known-symbols
      [Symbol.asyncIterator, 'Symbol.asyncIterator'],
      [Symbol.hasInstance, 'Symbol.hasInstance'],
      [Symbol.isConcatSpreadable, 'Symbol.isConcatSpreadable'],
      [Symbol.iterator, 'Symbol.iterator'],
      [Symbol.match, 'Symbol.match'],
      [Symbol.matchAll, 'Symbol.matchAll'],
      [Symbol.replace, 'Symbol.replace'],
      [Symbol.search, 'Symbol.search'],
      [Symbol.species, 'Symbol.species'],
      [Symbol.split, 'Symbol.split'],
      [Symbol.toPrimitive, 'Symbol.toPrimitive'],
      [Symbol.toStringTag, 'Symbol.toStringTag'],
      [Symbol.unscopables, 'Symbol.unscopables'],
    ];

    for (const [value, expected] of tests) {
      test(`${typeof value === 'symbol' ? value.description : value} encodes correctly`, () => {
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

  describe('Symbols', () => {
    test('encode correctly', () => {
      expect(encoder.encode(Symbol('meep'))).toEqual({
        type: 'symbol',
        id: 1,
        description: 'meep',
      });
    });

    test('reuse IDs across calls', () => {
      const sym1 = Symbol('meep');
      const sym2 = Symbol('meep');
      const expected1 = { type: 'symbol', id: 1, description: 'meep' };
      const expected2 = { ...expected1, id: 2 };
      expect(encoder.encode(sym1)).toEqual(expected1);
      expect(encoder.encode(sym1)).toEqual(expected1);
      expect(encoder.encode(sym2)).toEqual(expected2);
      expect(encoder.encode(sym1)).toEqual(expected1);
    });

    test('use refs for subsequent appearances', () => {
      const sym1 = Symbol('meep');
      const sym2 = Symbol('meep');
      const expected1 = { type: 'symbol', id: 2, description: 'meep' };
      const expected2 = { ...expected1, id: 3 };
      const ref1 = { type: 'ref', toId: 2 };
      const ref2 = { type: 'ref', toId: 3 };
      const input = { a: sym1, b: sym2, c: { d: sym1 }, e: sym2 };
      const expected = {
        type: 'object',
        id: 1,
        '.a': expected1,
        '.b': expected2,
        '.c': {
          type: 'object',
          id: 4,
          '.d': ref1,
        },
        '.e': ref2,
      };
      expect(encoder.encode(input)).toEqual(expected);
    });
  });

  describe('arrays', () => {
    test('simple', () => {
      expect(encoder.encode(['hello', 'world'])).toEqual({
        type: 'array',
        id: 1,
        ".0": 'hello',
        ".1": 'world',
      });
    });

    test('self-referencing', () => {
      const array = ['hello', 'world'];
      array.push(array);
      expect(encoder.encode(array)).toEqual({
        type: 'array',
        id: 1,
        '.0': 'hello',
        '.1': 'world',
        '.2': { type: 'ref', toId: 1 },
      });
    });
  });
});
