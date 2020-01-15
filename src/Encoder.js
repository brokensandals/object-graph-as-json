import { builtinsByValue } from './builtins';

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
      const prop = {};
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
      }

      const builtinName = builtinsByValue.get(value);
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

            const prototype = Object.getPrototypeOf(value);
            const propNames = Object.getOwnPropertyNames(value);
            const propSyms = Object.getOwnPropertySymbols(value);

            let impliedPrototype = Object.prototype;
            let skipLengthProp = false;
            if (typeof value === 'object' &&
                prototype === Array.prototype) {
              const lengthDesc = Object.getOwnPropertyDescriptor(value, 'length');
              const lengthIndex = propNames.indexOf('length');
              if (lengthDesc &&
                  propNames[lengthIndex - 1] == lengthDesc.value - 1 &&
                  lengthDesc.value >= 0) {
                result.type = 'array';
                impliedPrototype = Array.prototype;
                skipLengthProp = true;
              }
            } else if (typeof value === 'function') {
              impliedPrototype = Function.prototype;
              result.type = 'function';
              result.source = Function.prototype.toString.apply(value);
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
                result[newName] = { ...encodeProp(desc), type: 'property' };
              }
            }

            if (propSyms.length > 0) {
              const props = [];
              for (const sym of propSyms) {
                const prop = encodeProp(Object.getOwnPropertyDescriptor(value, sym));
                prop.key = recurse(sym);
                props.push(prop);
              }
              result.symbols = props;
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
