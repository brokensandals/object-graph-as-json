let globalObject;
if (typeof window !== 'undefined') {
  globalObject = window;
} else if (typeof self !== 'undefined') { // eslint-disable-line no-restricted-globals
  globalObject = self; // eslint-disable-line no-restricted-globals
} else if (typeof global !== 'undefined') {
  globalObject = global;
}

export const builtins = [
  [undefined, 'undefined'],
  [globalObject, 'globalThis'],

  // Number-related
  [NaN, 'NaN'],
  [Infinity, 'Infinity'],

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

  // Global functions
  [eval, 'eval'], // eslint-disable-line no-eval
  [typeof uneval !== 'undefined' && uneval, 'uneval'], // eslint-disable-line no-undef
  [isFinite, 'isFinite'], // eslint-disable-line no-restricted-globals
  [isNaN, 'isNaN'], // eslint-disable-line no-restricted-globals
  [parseFloat, 'parseFloat'],
  [parseInt, 'parseInt'],
  [decodeURI, 'decodeURI'],
  [decodeURIComponent, 'decodeURIComponent'],
  [encodeURI, 'encodeURI'],
  [encodeURIComponent, 'encodeURIComponent'],
  [typeof escape !== 'undefined' && escape, 'escape'],
  [typeof unescape !== 'undefined' && unescape, 'unescape'],

  // Utility classes
  [JSON, 'JSON'],
  [JSON.parse, 'JSON.parse'],
  [JSON.stringify, 'JSON.stringify'],
  [Intl, 'Intl'],
  [Math, 'Math'],
  [typeof Reflect !== 'undefined' && Reflect, 'Reflect'],
  [typeof WebAssembly !== 'undefined' && WebAssembly, 'WebAssembly'],

  // Constructors and prototypes
  [Array, 'Array'],
  [Array.prototype, 'Array.prototype'],
  [ArrayBuffer, 'ArrayBuffer'],
  [ArrayBuffer.prototype, 'ArrayBuffer.prototype'],
  [typeof BigInt !== 'undefined' && BigInt, 'BigInt'],
  [typeof BigInt !== 'undefined' && BigInt.prototype, 'BigInt.prototype'],
  // eslint-disable-next-line no-undef
  [typeof BigInt64Array !== 'undefined' && BigInt64Array, 'BigInt64Array'],
  // eslint-disable-next-line no-undef
  [typeof BigInt64Array !== 'undefined' && BigInt64Array.prototype, 'BigInt64Array.prototype'],
  // eslint-disable-next-line no-undef
  [typeof BigUint64Array !== 'undefined' && BigUint64Array, 'BigUint64Array'],
  // eslint-disable-next-line no-undef
  [typeof BigUint64Array !== 'undefined' && BigUint64Array.prototype, 'BigUint64Array.prototype'],
  [Boolean, 'Boolean'],
  [Boolean.prototype, 'Boolean.prototype'],
  [DataView, 'DataView'],
  [DataView.prototype, 'DataView.prototype'],
  [Date, 'Date'],
  [Date.prototype, 'Date.prototype'],
  [Error, 'Error'],
  [Error.prototype, 'Error.prototype'],
  [EvalError, 'EvalError'],
  [EvalError.prototype, 'EvalError.prototype'],
  [Float32Array, 'Float32Array'],
  [Float32Array.prototype, 'Float32Array.prototype'],
  [Float64Array, 'Float64Array'],
  [Float64Array.prototype, 'Float64Array.prototype'],
  [Function, 'Function'],
  [Function.prototype, 'Function.prototype'],
  [Int8Array, 'Int8Array'],
  [Int8Array.prototype, 'Int8Array.prototype'],
  [Int16Array, 'Int16Array'],
  [Int16Array.prototype, 'Int16Array.prototype'],
  [Int32Array, 'Int32Array'],
  [Int32Array.prototype, 'Int32Array.prototype'],
  [Intl.Collator, 'Intl.Collator'],
  [Intl.Collator.prototype, 'Intl.Collator.prototype'],
  [Intl.DateTimeFormat, 'Intl.DateTimeFormat'],
  [Intl.DateTimeFormat.prototype, 'Intl.DateTimeFormat.prototype'],
  [Intl.NumberFormat, 'Intl.NumberFormat'],
  [Intl.NumberFormat.prototype, 'Intl.NumberFormat.prototype'],
  [typeof Intl.PluralRules !== 'undefined' && Intl.PluralRules, 'Intl.PluralRules'],
  [typeof Intl.PluralRules !== 'undefined' && Intl.PluralRules.prototype, 'Intl.PluralRules.prototype'],
  [typeof Intl.RelativeTimeFormat !== 'undefined' && Intl.RelativeTimeFormat, 'Intl.RelativeTimeFormat'],
  [typeof Intl.RelativeTimeFormat !== 'undefined' && Intl.RelativeTimeFormat.prototype, 'Intl.RelativeTimeFormat.prototype'],
  [typeof Intl.Locale !== 'undefined' && Intl.Locale, 'Intl.Locale'],
  [typeof Intl.Locale !== 'undefined' && Intl.Locale.prototype, 'Intl.Locale.prototype'],
  [Map, 'Map'],
  [Map.prototype, 'Map.prototype'],
  [Number, 'Number'],
  [Number.prototype, 'Number.prototype'],
  [Object, 'Object'],
  [Object.prototype, 'Object.prototype'],
  [typeof Promise !== 'undefined' && Promise, 'Promise'],
  [typeof Promise !== 'undefined' && Promise.prototype, 'Promise.prototype'],
  [typeof Proxy !== 'undefined' && Proxy, 'Proxy'],
  [RangeError, 'RangeError'],
  [RangeError.prototype, 'RangeError.prototype'],
  [ReferenceError, 'ReferenceError'],
  [ReferenceError.prototype, 'ReferenceError.prototype'],
  [RegExp, 'RegExp'],
  [RegExp.prototype, 'RegExp.prototype'],
  [Set, 'Set'],
  [Set.prototype, 'Set.prototype'],
  [String, 'String'],
  [String.prototype, 'String.prototype'],
  [Symbol, 'Symbol'],
  [Symbol.prototype, 'Symbol.prototype'],
  [SyntaxError, 'SyntaxError'],
  [SyntaxError.prototype, 'SyntaxError.prototype'],
  [TypeError, 'TypeError'],
  [TypeError.prototype, 'TypeError.prototype'],
  [Uint8Array, 'Uint8Array'],
  [Uint8Array.prototype, 'Uint8Array.prototype'],
  [Uint8ClampedArray, 'Uint8ClampedArray'],
  [Uint8ClampedArray.prototype, 'Uint8ClampedArray.prototype'],
  [Uint16Array, 'Uint16Array'],
  [Uint16Array.prototype, 'Uint16Array.prototype'],
  [Uint32Array, 'Uint32Array'],
  [Uint32Array.prototype, 'Uint32Array.prototype'],
  [URIError, 'URIError'],
  [URIError.prototype, 'URIError.prototype'],
  [WeakMap, 'WeakMap'],
  [WeakMap.prototype, 'WeakMap.prototype'],
  [typeof WebAssembly !== 'undefined' && typeof WebAssembly.Module !== 'undefined' && WebAssembly.Module, 'WebAssembly.Module'],
  [typeof WebAssembly !== 'undefined' && typeof WebAssembly.Module !== 'undefined' && WebAssembly.Module.prototype, 'WebAssembly.Module.prototype'],
  [typeof WebAssembly !== 'undefined' && typeof WebAssembly.Instance !== 'undefined' && WebAssembly.Instance, 'WebAssembly.Instance'],
  [typeof WebAssembly !== 'undefined' && typeof WebAssembly.Instance !== 'undefined' && WebAssembly.Instance.prototype, 'WebAssembly.Instance.prototype'],
  [typeof WebAssembly !== 'undefined' && typeof WebAssembly.Module !== 'undefined' && WebAssembly.Memory, 'WebAssembly.Memory'],
  [typeof WebAssembly !== 'undefined' && typeof WebAssembly.Module !== 'undefined' && WebAssembly.Memory.prototype, 'WebAssembly.Memory.prototype'],
  [typeof WebAssembly !== 'undefined' && typeof WebAssembly.Module !== 'undefined' && WebAssembly.Table, 'WebAssembly.Table'],
  [typeof WebAssembly !== 'undefined' && typeof WebAssembly.Module !== 'undefined' && WebAssembly.Table.prototype, 'WebAssembly.Table.prototype'],
  [typeof WebAssembly !== 'undefined' && typeof WebAssembly.Module !== 'undefined' && WebAssembly.CompileError, 'WebAssembly.CompileError'],
  [typeof WebAssembly !== 'undefined' && typeof WebAssembly.Module !== 'undefined' && WebAssembly.CompileError.prototype, 'WebAssembly.CompileError.prototype'],
  [typeof WebAssembly !== 'undefined' && typeof WebAssembly.Module !== 'undefined' && WebAssembly.LinkError, 'WebAssembly.LinkError'],
  [typeof WebAssembly !== 'undefined' && typeof WebAssembly.Module !== 'undefined' && WebAssembly.LinkError.prototype, 'WebAssembly.LinkError.prototype'],
  [typeof WebAssembly !== 'undefined' && typeof WebAssembly.Module !== 'undefined' && WebAssembly.RuntimeError, 'WebAssembly.RuntimeError'],
  [typeof WebAssembly !== 'undefined' && typeof WebAssembly.Module !== 'undefined' && WebAssembly.RuntimeError.prototype, 'WebAssembly.RuntimeError.prototype'],
].filter(([val]) => val !== false);

export const builtinsByValue = new Map(builtins);
export const builtinsByName = new Map(builtins.map(([a, b]) => [b, a]));

export default builtins;
