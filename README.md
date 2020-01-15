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

Everything else is encoded to an object which contains, at minimum, a string field named `$_type`.
Allowed values for `$_type` are:

- `builtin`
- `bigint`
- `symbol`
- `array`
- `function`
- `object`
- `ref`
- `unknown`

Except for `builtin`, `bigint`, `ref`, and `unknown`, all of these objects will also contain a numeric field named `$_id`.
If an invocation of the encoder encounters the same object (in the sense of identity - i.e., it is the same single object in memory) more than once, all but the first occurrence will be encoded as `ref`s.
Each `$_id` is unique within the context of the output of one invocation of the encoder.

## builtin

Certain values are recognized and simply referred to by name using a wrapper object with two fields:

- `$_type` = `"builtin"`
- `$_name`: one of the following names:
  - `Infinity`
  - `NaN`
  - `Undefined`

## bigint

BigInts are encoded to an object with two fields:

- `$_type` = `"bigint"`
- `$_string`: the result of calling `.toString()` on the BigInt

## symbol

Symbols are encoded to an object with three fields:

- `$_type` = `"symbol"`
- `$_id`
- `$_description`: the result of retrieving `.description` from the Symbol

## array

If an array meets all the following conditions:

- Its `typeof` is `object`
- Its constructor is `Array`
- Its prototype is `Array.prototype`
- Its `length` field is writable but not enumerable or configurable, and not an accessor
- Its highest index is its `length` field minus 1

Then it will be encoded to an object with `$_type` = `"array"`.
These should be interpreted in the same way as `$_type` = `"object"` except:

- The original object's `typeof` is implied to be `object`.
- The `$_constructor` field will not be included, since it is implied to be `Array`.
- The `$_prototype` field will not be included, since it is implied to be `Array.prototype`.
- The `length` field will not be included, since it is assumed to equal the highest index plus 1 and to be writable but not enumerable or configurable and not an accessor.

## function

Anything whose `typeof` is `'function'` will be encoded to an object with `$_type` = `"function"`.
This is equivalent to `$_type` = `"object"` except:

- The original object's `typeof` is implied to be `function`.
- A `$_source` field is added containing the source code of the function as a string, to the best of the encoder's ability to determine it.
- `$_constructor` is assumed to be `Function` if it is absent.
- `$_prototype` is assumed to be `Function.prototype` if it is absent.

## object

Objects are encoded to objects with the following fields:

- `$_type` = `"object"`
- `$_id`
- `$_constructor`: The encoded result of calling `.constructor` on the object.
  May be omitted if it is `Object`.
- `$_prototype`: The encoded result of calling `Object.getPrototypeOf` on the object.
  May be omitted if it is `Object.prototype`.
- `$_stringProps`: Used if and only if some of the object's property names begin with `"$_"`.
   When present, it will contain _all_ the properties of the object whose keys are strings; none of those properties will appear directly on this object.
   This field is an object where the keys are the property names and the values are the encoded values of the properties, or property objects as described below.
- `$_symbolProps`: The properties of the object whose keys are symbols, as described below.
   Omitted if there are none.
   This field is an array where each element is a property object as described below.

All properties of the original object whose keys are strings will be included as fields on the encoded object, unless at least one of them has a name beginning with `"$_"`, in which case they will all 

### Properties

If _all_ of an object's own properties meet the following conditions:

- the key is a string
- the property is writable, enumerable, and configurable
- the property is not an accessor

Then the properties are simply represented by an object where the keys are the keys and the values are the encoded values.

Otherwise, the properties are represented by an array of objects, each of which has the following fields:

- `key`: the encoded value of the key (encoding is necessary when it's a symbol)
- `value`: the value, if it's not an accessor
- `get`: the encoded value of the getter, if any
- `set`: the encoded value of the setter, if any
- `writable`: boolean indicating whether the property is writable; may be omitted if `true`
- `enumerable`: boolean indicating whether the property is enumerable; may be omitted if `true`
- `configurable`: boolean indicating whether the property is configurable; may be omitted if `true`

## ref

While recursively encoding an object, if any object appears more than once, the content of the object will only be encoded the first time.
On subsequent encounters, it's encoded as a wrapper object with two fields:

- `type` = `"ref"`
- `toId`: the `id` that was used the first time the object was encoded

## unknown

If the encoder encounters a value whose `typeof` it does not recognize, it simply returns a wrapper object with two fields:

- `type` = `"unknown"`
- `typeof`: the result of `typeof`
