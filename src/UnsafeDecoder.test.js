import { builtins } from './builtins';
import Encoder from './Encoder';
import UnsafeDecoder from './UnsafeDecoder';

describe('UnsafeDecoder', () => {
  let encoder;
  let decoder;

  function encdec(value) {
    return decoder.decode(encoder.encode(value));
  }

  beforeEach(() => {
    encoder = new Encoder();
    decoder = new UnsafeDecoder();
    decoder.onFailure = (value, message) => ({ value, failure: message });
    decoder.onKeyFailure = (value, key, message) => ({ value, key, keyFailure: message });
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

    test('reuses symbols across decodings', () => {
      const original = Symbol();
      expect(encdec(original)).toBe(encdec(original));
    });

    test('reuses symbols within a decoding', () => {
      const sym1 = Symbol();
      const sym2 = Symbol();
      const original = [sym1, sym2, sym1];
      const result = encdec(original);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(result[2]);
      expect(result[0]).not.toBe(result[1]);
    });

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
      decoder.decode(encoded);
      encoded.description = 'new';
      expect(decoder.decode(encoded)).toEqual({
        value: encoded,
        failure: `symbol with id [${encoded.id}] has different description [new] than existing symbol with that id [old]`,
      });
    });
  });

  describe('arrays', () => {
    test('simple', () => {
      expect(encdec(['hello', 'world'])).toEqual(['hello', 'world']);
    });

    test('no id', () => {
      const input = { type: 'array' };
      expect(decoder.decode(input)).toEqual({
        value: input,
        failure: 'array is missing id',
      });
    });

    test('with prototype', () => {
      const input = { type: 'array', id: 1, prototype: { type: 'builtin', name: 'Object' } };
      expect(decoder.decode(input)).toEqual({
        value: input,
        failure: 'array with id [1] has prototype property which should have been implied',
      });
    });

    test('with length', () => {
      const input = { type: 'array', id: 1, '.length': 4 };
      expect(decoder.decode(input)).toEqual({
        value: input,
        failure: 'array with id [1] has .length property which should have been implied',
      });
    });

    test('with circular references', () => {
      const a = ['top'];
      const b = ['middle', a];
      a.push(b);
      const c = ['bottom', a];
      b.push(c);
      a.push(c);
      const result = encdec(a);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual('top');
      expect(result[1]).toHaveLength(3);
      expect(result[1][0]).toEqual('middle');
      expect(result[1][1]).toBe(result);
      expect(result[1][2]).toHaveLength(2);
      expect(result[1][2][0]).toEqual('bottom');
      expect(result[1][2][1]).toBe(result);
      expect(result[2]).toBe(result[1][2]);
    });

    test('with extra properties', () => {
      const original = ['hi', 'there'];
      original.extra = ['world'];
      original[Symbol('meep')] = 'MEEP';
      Object.defineProperty(original, 'justwritable', {
        value: ['whatevs'],
        writable: true,
        configurable: false,
        enumerable: false,
      });
      const result = encdec(original);
      expect(result).toHaveLength(2);
      expect(result.extra).toEqual(['world']);
      const syms = Object.getOwnPropertySymbols(result);
      expect(syms).toHaveLength(1);
      expect(syms[0].description).toEqual('meep');
      expect(result[syms[0]]).toEqual('MEEP');
      expect(result.justwritable).toEqual(['whatevs']);
      const desc = Object.getOwnPropertyDescriptor(result, 'justwritable');
      expect(desc.writable).toBeTruthy();
      expect(desc.configurable).toBeFalsy();
      expect(desc.enumerable).toBeFalsy();
    });

    test('with gaps in indices', () => {
      const original = ['hello'];
      original[3] = 'world';
      const result = encdec(original);
      expect(result.constructor).toBe(Array);
      expect(Object.getPrototypeOf(result)).toBe(Array.prototype);
      expect(result).toHaveLength(4);
      expect(result).toEqual(['hello', undefined, undefined, 'world']);
    });
  });

  describe('functions', () => {
    test('simple', () => {
      function addNums(a, b) {
        return a + b;
      }
      const result = encdec(addNums);
      expect(typeof result).toEqual('function');
      expect(Object.getPrototypeOf(result)).toBe(Function.prototype);
      expect(result.length).toEqual(2);
      expect(result.name).toEqual('addNums');
      expect(result.toString()).toEqual(addNums.toString());
      expect(result(5, 10)).toEqual(15);
      expect(result.prototype.constructor).toBe(result);
    });

    test('bound functions do not work', () => {
      function parrot() {
        return this;
      }
      const original = parrot.bind('hello');
      const encoded = encoder.encode(original);
      // It's an "Unexpected identifier" because, at least in Node, the source
      // code of bound functions includes `[native code]`.
      expect(decoder.decode(encoded)).toEqual({
        value: encoded,
        failure: 'function with id [1] could not be constructed: SyntaxError: Unexpected identifier',
      });
    });

    test('no id', () => {
      const input = { type: 'function', source: 'function foo() {}' };
      expect(decoder.decode(input)).toEqual({
        value: input,
        failure: 'function is missing id',
      });
    });

    test('no source', () => {
      const input = { type: 'function', id: 1 };
      expect(decoder.decode(input)).toEqual({
        value: input,
        failure: 'function with id [1] is missing source',
      });
    });

    test('invalid source', () => {
      const input = { type: 'function', id: 1, source: '\\' };
      expect(decoder.decode(input)).toEqual({
        value: input,
        failure: 'function with id [1] could not be constructed: SyntaxError: Invalid or unexpected token',
      });
    });

    test('with different prototype', () => {
      function foo() {
        return 'hi';
      }
      Object.setPrototypeOf(foo, Array.prototype);
      const result = encdec(foo);
      expect(typeof result).toEqual('function');
      expect(result.toString()).toEqual(foo.toString());
      expect(Object.getPrototypeOf(result)).toBe(Array.prototype);
    });

    test('with extra properties', () => {
      function original() {
        return 'hi';
      }
      original.extra = ['world'];
      original[Symbol('meep')] = 'MEEP';
      Object.defineProperty(original, 'justwritable', {
        value: ['whatevs'],
        writable: true,
        configurable: false,
        enumerable: false,
      });
      const result = encdec(original);
      expect(typeof result).toEqual('function');
      expect(result()).toEqual('hi');
      expect(result.extra).toEqual(['world']);
      const syms = Object.getOwnPropertySymbols(result);
      expect(syms).toHaveLength(1);
      expect(syms[0].description).toEqual('meep');
      expect(result[syms[0]]).toEqual('MEEP');
      expect(result.justwritable).toEqual(['whatevs']);
      const desc = Object.getOwnPropertyDescriptor(result, 'justwritable');
      expect(desc.writable).toBeTruthy();
      expect(desc.configurable).toBeFalsy();
      expect(desc.enumerable).toBeFalsy();
    });
  });

  describe('objects', () => {
    test('simple', () => {
      const original = { foo: 'bar' };
      const odesc = Object.getOwnPropertyDescriptor(original, 'foo');
      const result = encdec(original);
      expect(typeof result).toEqual('object');
      expect(result).toEqual({ foo: 'bar' });
      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      const rdesc = Object.getOwnPropertyDescriptor(result, 'foo');
      expect(rdesc).toEqual(odesc);
    });

    test('no id', () => {
      const input = { type: 'object' };
      expect(decoder.decode(input)).toEqual({
        value: input,
        failure: 'object is missing id',
      });
    });

    test('with circular references', () => {
      const a = { name: 'a' };
      a.b = { name: 'b' , a };
      a.b.c = { name: 'c', a, b: a.b };
      a.a = a;
      const result = encdec(a);
      expect(result.name).toEqual('a');
      expect(result.b.name).toEqual('b');
      expect(result.b.c.name).toEqual('c');
      expect(result.a).toBe(result);
      expect(result.b.a).toBe(result);
      expect(result.b.c.a).toBe(result);
      expect(result.b.c.b).toBe(result.b);
    });

    test('with different prototype', () => {
      const original = { foo: 'bar' };
      const originalProto = { useful: false };
      Object.setPrototypeOf(original, originalProto);
      const result = encdec(original);
      expect(result.foo).toEqual('bar');
      expect(Object.getPrototypeOf(result)).toEqual({ useful: false });
    });

    describe('builtin symbol properties', () => {
      test('success', () => {
        const original = { foo: 'bar', [Symbol.toStringTag]: 'whatevs' };
        const result = encdec(original);
        expect(result).toEqual({
          foo: 'bar',
          [Symbol.toStringTag]: 'whatevs',
        });
      });

      test('unknown name', () => {
        const input = { type: 'object', id: 1, '@garbage': 'foo' };
        let err;
        decoder.onFailure = (value, message) => {
          err = [value, message];
          return Symbol.toStringTag;
        };
        expect(decoder.decode(input)).toEqual({ [Symbol.toStringTag]: 'foo' });
        expect(err).toEqual([{ type: 'builtin', name: 'garbage' }, 'unrecognized builtin name [garbage]']);
      });

      test('non-symbol builtin', () => {
        const input = { type: 'object', id: 1, '@Array': 'foo' };
        let err;
        decoder.onKeyFailure = (value, key, message) => {
          err = [value, key, message];
          return Symbol.toStringTag;
        };
        expect(decoder.decode(input)).toEqual({ [Symbol.toStringTag]: 'foo' });
        expect(err).toEqual([input, '@Array', 'key [@Array] does not refer to a symbol']);
      });

      test('undefined returned from onKeyFailure', () => {
        const input = { type: 'object', id: 1, '@Array': 'foo' };
        let err;
        decoder.onKeyFailure = (value, key, message) => {
          err = [value, key, message];
          return undefined;
        };
        expect(decoder.decode(input)).toEqual({});
        expect(err).toEqual([input, '@Array', 'key [@Array] does not refer to a symbol']);
      });

      test('invalid return from onKeyFailure', () => {
        const input = { type: 'object', id: 1, '@Array': 'foo' };
        decoder.onKeyFailure = (value, key, message) => {
          return {};
        };
        expect(() => decoder.decode(input)).toThrow('onKeyFailure for key [@Array] did not return undefined, string, or symbol');
      });
    });

    describe('other symbol properties', () => {
      test('without description', () => {
        const original = { [Symbol()]: 'bar' };
        const result = encdec(original);
        const syms = Object.getOwnPropertySymbols(result);
        expect(syms).toHaveLength(1);
        expect(syms[0].description).toBeUndefined();
        expect(result[syms[0]]).toEqual('bar');
      });

      test('with empty description', () => {
        const original = { [Symbol('')]: 'bar' };
        const result = encdec(original);
        const syms = Object.getOwnPropertySymbols(result);
        expect(syms).toHaveLength(1);
        expect(syms[0].description).toEqual('');
        expect(result[syms[0]]).toEqual('bar');
      });

      test('with description', () => {
        const original = { [Symbol('meep')]: 'bar' };
        const result = encdec(original);
        const syms = Object.getOwnPropertySymbols(result);
        expect(syms).toHaveLength(1);
        expect(syms[0].description).toEqual('meep');
        expect(result[syms[0]]).toEqual('bar');
      });

      test('with description that conflicts with previous occurrence', () => {
        const original = { [Symbol('MEEP')]: 'bar' };
        const encoded = encoder.encode(original);
        decoder.decode(encoded);
        delete encoded['~2|MEEP'];
        encoded['~2|meep'] = 'bar';
        let err;
        decoder.onFailure = (value, message) => {
          err = [value, message];
          return Symbol.toStringTag;
        };
        const result = decoder.decode(encoded);
        expect(err).toEqual([{ type: 'symbol', id: '2', description: 'meep' }, 'symbol with id [2] has different description [meep] than existing symbol with that id [MEEP]']);
        expect(result).toEqual({ [Symbol.toStringTag]: 'bar' });
      });

      test('when onFailure does not return a symbol', () => {
        const original = { [Symbol('MEEP')]: 'bar' };
        const encoded = encoder.encode(original);
        decoder.decode(encoded);
        delete encoded['~2|MEEP'];
        encoded['~2|meep'] = 'bar';
        let err;
        decoder.onFailure = (value, message) => {
          return 'nope';
        };
        decoder.onKeyFailure = (value, key, message) => {
          err = [value, key, message];
          return 'fine';
        };
        const result = decoder.decode(encoded);
        expect(err).toEqual([encoded, '~2|meep', 'key [~2|meep] does not refer to a symbol']);
        expect(result).toEqual({ fine: 'bar' });
      });

      test('when onKeyFailure returns undefined', () => {
        const original = { [Symbol('MEEP')]: 'bar' };
        const encoded = encoder.encode(original);
        decoder.decode(encoded);
        delete encoded['~2|MEEP'];
        encoded['~2|meep'] = 'bar';
        let err;
        decoder.onFailure = (value, message) => {
          return 'nope';
        };
        decoder.onKeyFailure = (value, key, message) => {
          err = [value, key, message];
          return undefined;
        };
        const result = decoder.decode(encoded);
        expect(err).toEqual([encoded, '~2|meep', 'key [~2|meep] does not refer to a symbol']);
        expect(result).toEqual({});
      });

      test('invalid return from onKeyFailure', () => {
        const original = { [Symbol('MEEP')]: 'bar' };
        const encoded = encoder.encode(original);
        decoder.decode(encoded);
        delete encoded['~2|MEEP'];
        encoded['~2|meep'] = 'bar';
        decoder.onFailure = (value, message) => {
          return 'nope';
        };
        decoder.onKeyFailure = (value, key, message) => {
          return {};
        };
        expect(() => decoder.decode(encoded)).toThrow('onKeyFailure for key [~2|meep] did not return undefined, string, or symbol');
      });
    });

    describe('property descriptors', () => {
      test('configurable only', () => {
        const original = {};
        Object.defineProperty(original, 'foo', {
          configurable: true,
          enumerable: false,
          writable: false,
          value: { nested: 'bar' },
        });
        const result = encdec(original);
        expect(Object.getOwnPropertyDescriptor(result, 'foo')).toEqual({
          configurable: true,
          enumerable: false,
          writable: false,
          value: { nested: 'bar' },
        });
      });

      test('enumerable only', () => {
        const original = {};
        Object.defineProperty(original, 'foo', {
          configurable: false,
          enumerable: true,
          writable: false,
          value: { nested: 'bar' },
        });
        const result = encdec(original);
        expect(Object.getOwnPropertyDescriptor(result, 'foo')).toEqual({
          configurable: false,
          enumerable: true,
          writable: false,
          value: { nested: 'bar' },
        });
      });
      
      test('writable only', () => {
        const original = {};
        Object.defineProperty(original, 'foo', {
          configurable: false,
          enumerable: false,
          writable: true,
          value: { nested: 'bar' },
        });
        const result = encdec(original);
        expect(Object.getOwnPropertyDescriptor(result, 'foo')).toEqual({
          configurable: false,
          enumerable: false,
          writable: true,
          value: { nested: 'bar' },
        });
      });

      test('without data or accessor', () => {
        const input = {
          type: 'object',
          id: '1',
          '.foo': {
            type: 'property',
            writable: true,
          }
        };
        let err;
        decoder.onFailure = (value, message) => {
          err = [value, message];
          return {
            configurable: true,
            enumerable: false,
            writable: false,
            value: 'adjusted',
          };
        };
        const result = decoder.decode(input);
        expect(Object.getOwnPropertyDescriptor(result, 'foo')).toEqual({
          configurable: true,
          enumerable: false,
          writable: false,
          value: 'adjusted',
        });
        expect(err).toEqual([input['.foo'], 'property does not have get, set, or value']);
      });

      test('without data or accessor, and onFailure returns undefined', () => {
        const input = {
          type: 'object',
          id: '1',
          '.foo': {
            type: 'property',
            writable: true,
          }
        };
        let err;
        decoder.onFailure = (value, message) => {
          err = [value, message];
          return undefined;
        };
        expect(decoder.decode(input)).toEqual({});
        expect(err).toEqual([input['.foo'], 'property does not have get, set, or value']);
      });

      test('without data or accessor, and onFailure returns invalid', () => {
        const input = {
          type: 'object',
          id: '1',
          '.foo': {
            type: 'property',
            writable: true,
          }
        };
        let err;
        decoder.onFailure = (value, message) => {
          err = [value, message];
          return 'garbage';
        };
        expect(() => decoder.decode(input)).toThrow('Property description must be an object');
        expect(err).toEqual([input['.foo'], 'property does not have get, set, or value']);
      });

      test('with both data and accessor', () => {
        const input = {
          type: 'object',
          id: '1',
          '.foo': {
            type: 'property',
            value: 'bar',
            get: 'meh',
          },
        };
        let err;
        decoder.onFailure = (value, message) => {
          err = [value, message];
          return {
            configurable: true,
            enumerable: false,
            writable: false,
            value: 'adjusted',
          };
        };
        const result = decoder.decode(input);
        expect(Object.getOwnPropertyDescriptor(result, 'foo')).toEqual({
          configurable: true,
          enumerable: false,
          writable: false,
          value: 'adjusted',
        });
        expect(err).toEqual([input['.foo'], 'property has both accessor and value']);
      });

      test('with getter', () => {
        function getter() {
          return 'hi';
        }
        const original = {};
        Object.defineProperty(original, 'foo', {
          get: getter,
          enumerable: true,
          configurable: false,
        });
        const result = encdec(original);
        const desc = Object.getOwnPropertyDescriptor(result, 'foo');
        expect(desc).not.toBeNull();
        expect(desc.enumerable).toBeTruthy();
        expect(desc.configurable).toBeFalsy();
        expect(typeof desc.get).toEqual('function');
        expect(desc.set).toBeUndefined();
        expect(result.foo).toEqual('hi');
      });

      test('with setter', () => {
        function setter(arg) {
          this.received = arg;
        }
        const original = {};
        Object.defineProperty(original, 'foo', {
          set: setter,
          enumerable: true,
          configurable: false,
        });
        const result = encdec(original);
        const desc = Object.getOwnPropertyDescriptor(result, 'foo');
        expect(desc).not.toBeNull();
        expect(desc.enumerable).toBeTruthy();
        expect(desc.configurable).toBeFalsy();
        expect(typeof desc.set).toEqual('function');
        expect(desc.get).toBeUndefined();
        result.foo = 'woot';
        expect(result.received).toEqual('woot');
      });
    });
  });

  describe('refs', () => {
    // the "happy paths" are tested by the circular reference tests above

    test('no id', () => {
      const input = { type: 'ref' };
      expect(decoder.decode(input)).toEqual({
        value: input,
        failure: 'ref is missing id',
      });
    });

    test('id unrecognized', () => {
      const input = { type: 'ref', id: 1 };
      expect(decoder.decode(input)).toEqual({
        value: input,
        failure: 'id [1] was first encountered on a ref',
      });
    });
  });

  test('unknown types', () => {
    const input = { type: 'garbage', foo: 'bar' };
    expect(decoder.decode(input)).toEqual({
      value: input,
      failure: 'unknown type [garbage]',
    });
  });
});
