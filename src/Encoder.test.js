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
      const ref1 = { type: 'ref', id: 2 };
      const ref2 = { type: 'ref', id: 3 };
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
        '.2': { type: 'ref', id: 1 },
      });
    });

    test('with gaps', () => {
      const array = ['a'];
      array[2] = 'b';
      expect(encoder.encode(array)).toEqual({
        type: 'array',
        id: 1,
        '.0': 'a',
        '.2': 'b',
      });
    });

    test('with negative indices', () => {
      // these are actually just extra properties
      const array = [];
      array[-4] = 'a';
      expect(encoder.encode(array)).toEqual({
        type: 'object',
        id: 1,
        prototype: { type: 'builtin', name: 'Array.prototype' },
        '.length': {
          type: 'property',
          value: 0,
          writable: true,
        },
        '.-4': 'a',
      });
    });

    test('with negative and positive indices', () => {
      // the negative indices are really just extra properties
      const array = [];
      array[-4] = 'a';
      array[4] = 'b';
      expect(encoder.encode(array)).toEqual({
        type: 'array',
        id: 1,
        '.4': 'b',
        '.-4': 'a',
      });
    });

    test('with extra properties', () => {
      const array = ['hello', 'world'];
      array.foo = 'bar';
      const sym = Symbol('meep');
      array[sym] = 'hi';
      expect(encoder.encode(array)).toEqual({
        type: 'array',
        id: 1,
        symbols: [{
          key: { type: 'symbol', id: 2, description: 'meep' },
          value: 'hi',
          writable: true,
          enumerable: true,
          configurable: true,
        }],
        '.0': 'hello',
        '.1': 'world',
        '.foo': 'bar',
      });
    });

    test('with different constructors', () => {
      const array = ['hello', 'world'];
      const weird = { isThisNormal: 'no' };
      array.constructor = weird;
      expect(encoder.encode(array)).toEqual({
        type: 'array',
        id: 1,
        '.0': 'hello',
        '.1': 'world',
        '.constructor': {
          type: 'object',
          id: 2,
          '.isThisNormal': 'no',
        },
      });
    });

    test('with different prototypes', () => {
      const array = ['hello', 'world'];
      const weird = { isThisNormal: 'no' };
      Object.setPrototypeOf(array, weird);
      expect(encoder.encode(array)).toEqual({
        type: 'object',
        id: 1,
        prototype: {
          type: 'object',
          id: 2,
          '.isThisNormal': 'no',
        },
        '.0': 'hello',
        '.1': 'world',
        '.length': {
          type: 'property',
          value: 2,
          writable: true,
        },
      });
    });
  });

  describe('functions', () => {
    test('simple', () => {
      function foo(a, b) {
        return a + b;
      }

      // TODO: I don't understand why the "arguments" and "caller" properties
      // don't exist on foo even though they exist if I create a similar function
      // in the console
      expect(encoder.encode(foo)).toEqual({
        type: 'function',
        id: 1,
        source: 'function foo(a, b) {\n        return a + b;\n      }',
        '.length': {
          type: 'property',
          value: 2,
          configurable: true,
        },
        '.name': {
          type: 'property',
          value: 'foo',
          configurable: true,
        },
        '.prototype': {
          type: 'property',
          value: {
            type: 'object',
            id: 2,
            '.constructor': {
              type: 'property',
              value: { type: 'ref', id: 1 },
              configurable: true,
              writable: true,
            },
          },
          writable: true,
        },
      });
    });

    test('with different prototype', () => {
      function foo(a, b) {
        return a + b;
      }
      Object.setPrototypeOf(foo, Object);
      expect(encoder.encode(foo)).toEqual({
        type: 'function',
        id: 1,
        source: 'function foo(a, b) {\n        return a + b;\n      }',
        prototype: { type: 'builtin', name: 'Object' },
        '.length': {
          type: 'property',
          value: 2,
          configurable: true,
        },
        '.name': {
          type: 'property',
          value: 'foo',
          configurable: true,
        },
        '.prototype': {
          type: 'property',
          value: {
            type: 'object',
            id: 2,
            '.constructor': {
              type: 'property',
              value: { type: 'ref', id: 1 },
              configurable: true,
              writable: true,
            },
          },
          writable: true,
        },
      });
    });

    test('with different prototype property', () => {
      function foo(a, b) {
        return a + b;
      }
      foo.prototype = 'howdy';
      expect(encoder.encode(foo)).toEqual({
        type: 'function',
        id: 1,
        source: 'function foo(a, b) {\n        return a + b;\n      }',
        '.length': {
          type: 'property',
          value: 2,
          configurable: true,
        },
        '.name': {
          type: 'property',
          value: 'foo',
          configurable: true,
        },
        '.prototype': {
          type: 'property',
          value: 'howdy',
          writable: true,
        },
      });
    });

    test('with custom toString', () => {
      let called = false;
      function foo(a, b) {
        return a + b;
      }
      function custom() {
        called = true;
        return 'boo';
      }
      custom.prototype = Object;
      Object.setPrototypeOf(foo, { toString: custom });
      const encoded = encoder.encode(foo);
      expect(encoded.prototype).toEqual({
        type: 'object',
        id: 2,
        '.toString': {
          type: 'function',
          id: 3,
          source: 'function custom() {\n        called = true;\n        return \'boo\';\n      }',
          '.length': {
            type: 'property',
            value: 0,
            configurable: true,
          },
          '.name': {
            type: 'property',
            value: 'custom',
            configurable: true,
          },
          '.prototype': {
            type: 'property',
            value: { type: 'builtin', name: 'Object' },
            writable: true,
          },
        }
      });
      expect(foo.toString()).toEqual('boo');
      expect(encoded.source).toEqual('function foo(a, b) {\n        return a + b;\n      }')
    });

    test('with extra properties', () => {
      function foo(a, b) {
        return a + b;
      }
      foo.bar = 'meh';
      const sym = Symbol('meep');
      foo[sym] = 'hi';
      expect(encoder.encode(foo)).toEqual({
        type: 'function',
        id: 1,
        source: 'function foo(a, b) {\n        return a + b;\n      }',
        symbols: [
          {
            key: { type: 'symbol', id: 3, description: 'meep' },
            value: 'hi',
            writable: true,
            enumerable: true,
            configurable: true,
          }
        ],
        '.length': {
          type: 'property',
          value: 2,
          configurable: true,
        },
        '.name': {
          type: 'property',
          value: 'foo',
          configurable: true,
        },
        '.prototype': {
          type: 'property',
          value: {
            type: 'object',
            id: 2,
            '.constructor': {
              type: 'property',
              value: { type: 'ref', id: 1 },
              configurable: true,
              writable: true,
            },
          },
          writable: true,
        },
        '.bar': 'meh',
      });
    });
  });
});
