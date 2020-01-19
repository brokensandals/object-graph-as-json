# object-graph-as-json

[![Build Status](https://travis-ci.org/brokensandals/object-graph-as-json.svg?branch=master)](https://travis-ci.org/brokensandals/object-graph-as-json)

Given an arbitrary javascript object, this library encodes it using only JSON-safe data types.
Tools for decoding the data are provided too.

This enables serializing/deserializing objects that `JSON.stringify` cannot handle.

Contents:

1. [Goals](#goals)
2. [Usage](#usage)
3. [Spec](#spec)
4. [Status & Known Limitations](#status--known-limitations)
5. [Development](#development)
6. [Contributing](#contributing)
7. [License](#license)

## Goals

1. Support encoding circular / cyclic references among objects.
2. Preserve as much detail as feasible about every type of javascript object.
    - Even if decoding to an equivalent object will be impossible, consumers should still be able to access as much information as possible about what the original object was like.
3. Be safe for automated tooling to inject at arbitrary points in a program without changing the program's behavior.
    - Therefore, property getters will not be called unless they are built-in parts of javascript that do not have side effects.
      (But the existence of the getter, and its function object, will be encoded.)
4. If desired, encode information about an object's identity.
    - Enables determining whether two encoded objects (whether they are otherwise identical or not) originated from the same in-memory object or not.
5. Represent common object types in a way that minimizes the amount of visual noise for a human inspecting the encoded graph.
6. Keep the encoder small.

## Usage

Install:

```bash
npm i --save object-graph-as-json
```

Import the encoder:

```javascript
import { Encoder } from 'object-graph-as-json';
```

Make whatever objects you want to encode; we'll demonstrate by creating a counter:

```javascript
function increment() {
  this.current++;
}
const counter = {
  current: 1,
  increment,
};
counter.increment();
console.log(counter.current); // 2
```

Encode the objects:

```javascript
const encoder = new Encoder();
const encoded = encoder.encode(counter);
const json = JSON.stringify(encoded, null, 2);
console.log(json);
```

Output:

```json
{
  "id": "1",
  "type": "object",
  ".current": 2,
  ".increment": {
    "id": "2",
    "type": "function",
    "source": "function increment() {\n  this.current++;\n}",
    ".length": {
      "type": "property",
      "value": 0,
      "configurable": true
    },
    ".name": {
      "type": "property",
      "value": "increment",
      "configurable": true
    },
    ".arguments": {
      "type": "property",
      "value": null
    },
    ".caller": {
      "type": "property",
      "value": null
    },
    ".prototype": {
      "type": "property",
      "value": {
        "id": "3",
        "type": "object",
        ".constructor": {
          "type": "property",
          "value": {
            "id": "2",
            "type": "ref"
          },
          "writable": true,
          "configurable": true
        }
      },
      "writable": true
    }
  }
}
```

See the docs in [src/Encoder.js](src/Encoder.js) for more info.

If you like to live on the edge, you can also decode the output back to real javascript objects:

```javascript
import { UnsafeDecoder } from 'object-graph-as-json';

const parsed = JSON.parse(json);
const decoder = new UnsafeDecoder();
// DO NOT DO THIS WITH UNTRUSTED INPUT!
const decoded = decoder.decode(parsed);
console.log(decoded.current); // 2
decoded.increment();
console.log(decoded.current); // 3
```

UnsafeDecoder allows the input to run arbitrary code at decode time, as [demonstrated in src/index.test.js](src/index.test.js), so it is not suitable for use in most situations without modification.
See [the jsdoc in src/UnsafeDecoder.js](src/UnsafeDecoder.js) for more info.

### Embedding

I have a specific use case for this project where I need to inject the Encoder into a piece of javascript code that I have as a string.
For this purpose, it's useful to have the source code of the encoder as a string, in a form that is standalone and can be isolated from the code it's being injected into.

Therefore, the build produces an extra file, `embed.js`, whose default export is an object containing two fields, `Encoder` and `UnsafeDecoder`.
Each contains a string of javascript code that declares `var Encoder` or `var UnsafeDecoder` and sets it to the encoder or decoder respectively.

Example usage:

```javascript
import sources from 'object-graph-as-json/target/cjs/embed.js';

const myCode = "const foo = {bar: 'baz'}";
const wrappedCode = `
  const Encoder = (function(){${sources.Encoder};return Encoder.default})();
  ${myCode};
  console.log(new Encoder().encode(foo));
`;
(0, eval)(wrappedCode); // logs { id: '1', type: 'object', '.bar': 'baz' }
```

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
- `property` (only allowed for array/function/object property values)
- `ref`
- `unknown`

`symbol`, `array`, `function`, `object`, and `ref` all contain fields named `id` which are used for indicating when the same original in-memory object appears at multiple points in the object graph.
Within a single encoded graph:
- All symbols with the same id are the same symbol, and all symbols with different ids are different symbols.
- The same id cannot appear on more than one array, function, or object; instead, after the first occurrence, a `ref` will be used instead.
    - Objects/arrays/functions with different ids originate from different in-memory objects.
    - All refs to the same id originated from the same in-memory object as the object/array/symbol on which that id appeared.
    - No objects, arrays, functions, or refs should have the same id as a symbol.


### builtin

Certain values are recognized and simply referred to by name using an object with two fields:

- `type` = `"builtin"`
- `name`: See [src/builtins.js](src/builtins.js) for a current list of supported names.

### bigint

BigInts are encoded to an object with two fields:

- `type` = `"bigint"`
- `string`: The result of calling `.toString()` on the BigInt.

### symbol

Symbols are encoded to an object with three fields:

- `type` = `"symbol"`
- `id`
- `description`: The result of retrieving `.description` from the Symbol.

When the same id occurs on multiple symbols within a graph, the description must be the same on all of them.

### array

If an array meets all the following conditions:

- Its `typeof` is `object`.
- Its prototype is `Array.prototype`.
- Its `length` field is writable but not enumerable or configurable, and not an accessor.
- Its highest index is its `length` field minus 1.
- Its `length` field is >= 0.

Then it may be encoded to an object with `type` = `"array"`.
These should be interpreted in the same way as `type` = `"object"` except:

- The original object's `typeof` is implied to be `object`.
- The `prototype` field will not be included, since it is implied to be `Array.prototype`.
- The `length` field will not be included, since it is assumed to equal the highest index plus 1 and to be writable but not enumerable or configurable and not an accessor.

### function

Anything whose `typeof` is `'function'` will be encoded to an object with `type` = `"function"`.
This is equivalent to `type` = `"object"` except:

- The original object's `typeof` is implied to be `function`.
- A `source` field is added containing the source code of the function as a string, to the best of the encoder's ability to determine it.
  - This is not guaranteed to be valid javascript code.
    Native functions, for example, may include the string `[native code]` in place of valid javascript code.
- `prototype` is assumed to be `Function.prototype` if it is absent.

### object

Objects are encoded to objects with the following fields:

- `type` = `"object"`
- `id`
- `prototype`: The encoded result of calling `Object.getPrototypeOf` on the object.
  May be omitted if it is `Object.prototype`.
- All of the original object's properties are encoded as properties.
  - If the key is a string, it is encoded as that string, but prefixed with `"."`.
  - If the key is a symbol and is a builtin, it is encoded as `"@name"`
  - If the key is a symbol that is not a builtin and does not have a description, it is encoded as `"~id"`, where `id` is the unique identifier assigned to the symbol for the purposes of encoding.
  - If the key is a symbol that is not a builtin and has a description, it is encoded as `"~id|description"`.
    Note that the description may be an empty string, which is different from having no description (`symbol.description === ''` vs `symbol.description === undefined`).
  - The value is encoded as described in the section on [properties](#property) below.

### property

If a property meets all the following conditions:

- It is not an accessor.
- It is writable, enumerable, and configurable.

Then the encoded value will be stored directly on the object.
Otherwise, a property object will be created, which has the following structure:

- `type` = `"property"`
- `value`: The encoded value of the property; omitted for accessor properties.
- `get`: The encoded value of the getter, if any, for accessor properties.
- `set`: The encoded value of the setter, if any, for accessor properties.
- `writable`: Boolean, may be omitted if false.
- `enumerable`: Boolean, may be omitted if false.
- `configurable`: Boolean, may be omitted if false.

### ref

While encoding an object graph, if any object/array/function appears more than once, the content of the object will only be encoded the first time.
On subsequent encounters, it's encoded as a wrapper object with two fields:

- `type` = `"ref"`
- `id`: The `id` that was used the first time the object was encoded.

Note that refs are not used for symbols, because symbols can also occur in property keys (see section on [objects](#object) above), and it is simpler to just duplicate the information about the symbol than to account for the possibility of a ref to a property key.
But all symbols with the same id within the graph should be decoded to the same Symbol object.

### unknown

If the encoder encounters a value whose `typeof` it does not recognize, it simply returns a wrapper object with two fields:

- `type` = `"unknown"`
- `typeof`: The result of `typeof`.

## Status & Known Limitations

- More types will likely be added in order to compactly represent things such as regexes.
- Many more objects need to be added to the list of recognized builtins.
- Recreating functions in general is janky.
  - Bound functions (i.e. the result of calling `.bind(...)` on a function) cannot be recreated from their encoded form.
  As far as I'm aware, javascript does not provide a way to programmatically determine that a function object is a bound function or to retrieve the bindings or the original function from a bound function.
  The source code string for a bound function generally refers to native code.
  - Variable bindings from enclosing lexical scopes are not preserved.
  - The current UnsafeDecoder implementation assumes that the source code of the function is a valid function declaration, expression, or arrow function expression.
    But depending on your execution environment, calling toString() on a method (which is what the encoder does to determine the source code) may result in a string that starts with the method name instead.
- An instance of `Encoder` or `UnsafeDecoder` will never forget a symbol that it has seen.
  If you use long-lived instances of these, and for some reason your program produces large numbers of new symbols which are included in objects that it encodes, this is a memory leak.

## Development

Requires [node](https://nodejs.org) and [npm](https://www.npmjs.com).

Clone this repo and run `npm install` to install development dependencies.

Run `npm test` or `npm test:watch` to run the unit tests.

Run `npm build` to produce builds in the `target` folder targeting CommonJS, ECMAScript Modules, and UMD.
This also generates the embed.js file [discussed above](#embedding).

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/brokensandals/object-graph-as-json.

## License

This is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).
