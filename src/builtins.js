export const builtins = [
  [undefined, 'undefined'],

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

  // Constructors and prototypes
  [Array, 'Array'],
  [Array.prototype, 'Array.prototype'],
  [Function, 'Function'],
  [Function.prototype, 'Function.prototype'],
  [Object, 'Object'],
  [Object.prototype, 'Object.prototype'],
];

export const builtinsByValue = new Map(builtins);
export const builtinsById = new Map(builtins.map(([a, b]) => [b, a]));

export default builtins;
