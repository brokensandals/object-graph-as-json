const builtins = new Map();
builtins.set(Infinity, 'Infinity');
// Well-known symbols - https://tc39.es/ecma262/#sec-well-known-symbols
const wellKnownSymbols = [
  Symbol.asyncIterator,
  Symbol.hasInstance,
  Symbol.isConcatSpreadable,
  Symbol.iterator,
  Symbol.match,
  Symbol.matchAll,
  Symbol.replace,
  Symbol.search,
  Symbol.species,
  Symbol.split,
  Symbol.toPrimitive,
  Symbol.toStringTag,
  Symbol.unscopables,
]
for (const symbol of wellKnownSymbols) {
  builtins.set(symbol, symbol.description);
}

export class Encoder {
  constructor() {
    this.objectIds = new WeakMap();
    this.symbolIds = new Map();
    this.nextId = 1;
  }

  internObject(value) {
    let id = this.objectIds.get(value);
    
    if (!id) {
      id = this.nextId++;
      this.objectIds.set(value, id);
    }

    return id;
  }

  internSymbol(symbol) {
    let id = this.symbolIds.get(symbol);

    if (!id) {
      id = this.nextId++;
      this.symbolIds.set(symbol, id);
    }

    return id;
  }

  encode(value) {
    let refIds = null;

    const recurse = value => {
      if (value === null) {
        return null;
      } else if (Object.is(NaN, value)) {
        return { type: 'builtin', name: 'NaN' };
      }

      const builtinName = builtins.get(value);
      if (builtinName) {
        return { type: 'builtin', name: builtinName };
      }

      const type = typeof value;
      switch (type) {
        case 'undefined':
          return { 'type': 'builtin', 'name': 'undefined' };
        case 'boolean':
          return value;
        case 'number':
          return value;
        case 'bigint':
          return { 'type': 'bigint', 'string': value.toString() };
        case 'string':
          return value;
        case 'symbol':
          const id = this.internSymbol(value);
          
          if (!refIds) {
            refIds = new Set();
          }
          if (refIds.has(id)) {
            return { type: 'ref', id };
          }

          refIds.add(id);
          return { type, id, description: value.description };
        case 'function':
          // TODO
          break;
        case 'object':
          // TODO
          break;
        default:
          return { type: 'unknown', typeof: type };
      }
    }

    return recurse(value);
  }
}
