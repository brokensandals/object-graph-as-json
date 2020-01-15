# object-graph-as-json

Given an arbitrary javascript object, this library encodes it using only JSON-safe data types.
Tools for decoding the data are provided too.

This enables serializing/deserializing objects that `JSON.stringify` cannot handle.

Goals:

1. Support encoding circular / cyclic references among objects.
2. Preserve as much detail as feasible about every type of javascript object.
    - Even if decoding to an equivalent object will be impossible, consumers should still be able to access as much information as possible about what the original object was like.
3. Be safe for automated tooling to inject at arbitrary points in a program without changing the program's behavior.
    - Therefore, property getters will not be called unless they are built-in parts of javascript that do not have side effects.
      (But the existence of the getter, and its function object, will be encoded.)
4. If desired, encode information about an object's identity.
    - Enables determining whether two encoded objects (whether they are otherwise identical or not) originated from the same in-memory object or not.

## Spec

Numbers (excluding `NaN` and `Infinity`), strings, booleans, and `null` are unchanged by encoding.

Everything else is encoded to an object which contains, at minimum, a string field named `type`.
Allowed values for `type` are:

- `builtin`
- `bigint`
- `symbol`
- `array`
- `function`
- `object`
- `ref`
- `unknown`

Except for `builtin`, `bigint`, `ref`, and `unknown`, all of these objects will also contain a numeric field named `id`.
If an invocation of the encoder encounters the same object (in the sense of identity - i.e., it is the same single object in memory) more than once, all but the first occurrence will be encoded as `ref`s.
Each `id` is unique within the context of the output of one invocation of the encoder.

## builtin

Certain values are recognized and simply referred to by name using a wrapper object with two fields:

- `type` = `"builtin"`
- `name`: one of the following names:
  - `Infinity`
  - `NaN`
  - `Undefined`

## bigint

BigInts are encoded to an object with two fields:

- `type` = `"bigint"`
- `string`: the result of calling `.toString()` on the BigInt

## symbol

Symbols are encoded to an object with three fields:

- `type` = `"symbol"`
- `id`
- `description`: the result of retrieving `.description` from the Symbol

## array

If an array meets all the following conditions:

- Its `typeof` is `object`
- Its constructor is `Array`
- Its prototype is `Array.prototype`
- Its `length` field is writable but not enumerable or configurable, and not an accessor
- Its highest index is its `length` field minus 1
- Its `length` field is >= 0

Then it may be encoded to an object with `type` = `"array"`.
These should be interpreted in the same way as `type` = `"object"` except:

- The original object's `typeof` is implied to be `object`.
- The `constructor` field will not be included, since it is implied to be `Array`.
- The `prototype` field will not be included, since it is implied to be `Array.prototype`.
- The `length` field will not be included, since it is assumed to equal the highest index plus 1 and to be writable but not enumerable or configurable and not an accessor.

## function

Anything whose `typeof` is `'function'` will be encoded to an object with `type` = `"function"`.
This is equivalent to `type` = `"object"` except:

- The original object's `typeof` is implied to be `function`.
- A `source` field is added containing the source code of the function as a string, to the best of the encoder's ability to determine it.
- `constructor` is assumed to be `Function` if it is absent.
- `prototype` is assumed to be `Function.prototype` if it is absent.

## object

Objects are encoded to objects with the following fields:

- `type` = `"object"`
- `id`
- `constructor`: The encoded result of calling `.constructor` on the object.
  May be omitted if it is `Object`.
- `prototype`: The encoded result of calling `Object.getPrototypeOf` on the object.
  May be omitted if it is `Object.prototype`.
- `symbolProps`: The properties of the object whose keys are symbols, as described below.
   Omitted if there are none.
   This field is an array where each element is a property object as described below.
- All of the original object's string-keyed properties are encoded as properties where the key is the original key prepended with a period, and the value is either the encoded value or a property object as described below.

### Property Values

If a property meets all the following conditions:

- Its key is a string
- It is not an accessor
- It is writable, enumerable, and configurable

then the encoded value will be stored directly on the object.
Otherwise, a property object will be created, which has the following structure:

- `type` = `"property"`
- `key`: only used for symbol-keyed properties, where it is the encoded value of the key
- `value`: the encoded value of the property; omitted for accessor properties
- `get`: the encoded value of the getter, if any, for accessor properties
- `set`: the encoded value of the setter, if any, for accessor properties
- `writable`: Boolean, may be omitted if false
- `enumerable`: Boolean, may be omitted if false
- `configurable`: Boolean, may be omitted if false

## ref

While recursively encoding an object, if any object appears more than once, the content of the object will only be encoded the first time.
On subsequent encounters, it's encoded as a wrapper object with two fields:

- `type` = `"ref"`
- `toId`: the `id` that was used the first time the object was encoded

## unknown

If the encoder encounters a value whose `typeof` it does not recognize, it simply returns a wrapper object with two fields:

- `type` = `"unknown"`
- `typeof`: the result of `typeof`
