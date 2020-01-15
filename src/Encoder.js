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

// Constructors and prototypes
builtins.set(Array, 'Array');
builtins.set(Array.prototype, 'Array.prototype');
builtins.set(Function, 'Function');
builtins.set(Function.prototype, 'Function.prototype');
builtins.set(Object, 'Object');
builtins.set(Object.prototype, 'Object.prototype');

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

    const encodeProp = desc => {
      const prop = { type: 'property' };
      if (desc.get) {
        prop.get = recurse(desc.get);
      }
      if (desc.set) {
        prop.set = recurse(desc.set);
      }
      if (!desc.get && !desc.set) {
        prop.value = recurse(desc.value);
      }
      if (desc.writable) {
        prop.writable = true;
      }
      if (desc.enumerable) {
        prop.enumerable = true;
      }
      if (desc.configurable) {
        prop.configurable = true;
      }
      return prop;
    }

    const recurse = value => {
      if (value === null) {
        return null;
      } else if (Object.is(NaN, value)) {
        return { name: 'NaN', type: 'builtin' };
      }

      const builtinName = builtins.get(value);
      if (builtinName) {
        return { name: builtinName, type: 'builtin' };
      }

      const type = typeof value;
      switch (type) {
        case 'undefined':
          return { name: 'undefined', type: 'builtin' };
        case 'boolean':
          return value;
        case 'number':
          return value;
        case 'bigint':
          return { string: value.toString(), type: 'bigint' };
        case 'string':
          return value;
        case 'symbol':
          {
            const id = this.internSymbol(value);
            
            if (!refIds) {
              refIds = new Set();
            }
            if (refIds.has(id)) {
              return { id, type: 'ref' };
            }

            refIds.add(id);
            return { description: value.description, id, type };
          }
        case 'function':
        case 'object':
          {
            const id = this.internObject(value);

            if (!refIds) {
              refIds = new Set();
            }
            if (refIds.has(id)) {
              return { id, type: 'ref' };
            }

            refIds.add(id);
            
            const result = { id, type: 'object' };

            const constructor = value.constructor;
            const prototype = Object.getPrototypeOf(value);
            const propNames = Object.getOwnPropertyNames(value);
            const propSyms = Object.getOwnPropertySymbols(value);

            let impliedConstructor = Object;
            let impliedPrototype = Object.prototype;
            let skipLengthProp = false;
            if (typeof value === 'object' &&
                constructor === Array &&
                prototype === Array.prototype) {
              const lengthDesc = Object.getOwnPropertyDescriptor(value, 'length');
              const lengthIndex = propNames.indexOf('length');
              if (lengthDesc &&
                  propNames[lengthIndex - 1] == lengthDesc.value - 1 &&
                  lengthDesc.value >= 0) {
                result.type = 'array';
                impliedConstructor = Array;
                impliedPrototype = Array.prototype;
                skipLengthProp = true;
              }
            } else if (typeof value === 'function') {
              impliedConstructor = Function;
              impliedPrototype = Function.prototype;
              result.type = 'function';
              result.source = Function.prototype.toString.apply(value);
            }

            if (constructor !== impliedConstructor) {
              result.constructor = recurse(constructor);
            }
            if (prototype !== impliedPrototype) {
              result.prototype = recurse(prototype);
            }

            for (const name of propNames) {
              if (skipLengthProp && name === 'length') {
                continue;
              }

              const desc = Object.getOwnPropertyDescriptor(value, name);
              const newName = `.${name}`;
              if (desc.writable && desc.enumerable && desc.configurable &&
                  !desc.get && !desc.set) {
                result[newName] = recurse(desc.value);
              } else {
                result[newName] = encodeProp(desc);
              }
            }

            if (propSyms.length > 0) {
              const props = [];
              for (const sym of propSyms) {
                const prop = encodeProp(Object.getOwnPropertyDescriptor(value, sym));
                prop.key = recurse(sym);
                props.push(prop);
              }
              result.symbolProps = props;
            }

            return result;
          }
        default:
          return { type: 'unknown', typeof: type };
      }
    }

    return recurse(value);
  }
}
