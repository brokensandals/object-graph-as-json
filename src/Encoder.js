import { builtinsByValue } from './builtins';

/**
 * Takes arbitrary javascript objects and encodes them using only JSON-safe objects.
 *
 * Usage:
 *   const encoder = new Encoder();
 *   const result = encoder.encode(myObject);
 *
 * The instance of Encoder remembers objects and symbols that it has seen before, and
 * will encode them with the same ID on subsequent calls to .encode(). By default,
 * IDs are sequentially generated, and if you create a new Encoder instance the IDs
 * will start over at '1' again.
 *
 * You can override the generateId() method to change how IDs are generated, or
 * override internObject() and internValue() to manage the lookup of existing objects
 * yourself.
 */
export default class Encoder {
  constructor() {
    this.objectIds = new WeakMap();
    this.symbolIds = new Map();
    this.nextId = 1;
  }

  /**
   * @returns {string} a new id that is unique at least within the
   *   context of this Encoder instance
   */
  generateId() {
    const id = this.nextId;
    this.nextId += 1;
    return id.toString();
  }

  /**
   * Retrieves or creates an id for an object, array, or function.
   * At least within the context of this instance of the Encoder, this
   * should return the same value every time it is called for the same in-memory
   * object, and different values when called for different in-memory objects.
   * @param {*} value an object, array, or function
   * @returns {string} the id
   */
  internObject(value) {
    let id = this.objectIds.get(value);

    if (!id) {
      id = this.generateId();
      this.objectIds.set(value, id);
    }

    return id;
  }

  /**
   * Retrieves or creates an id for a symbol.
   * At least within the context of this instance of the Encoder, this should
   * return the same value every time it is called for the same symbol, and different values
   * when called for different symbols.
   * @param {*} symbol
   * @returns {string} the id
   */
  internSymbol(symbol) {
    let id = this.symbolIds.get(symbol);

    if (!id) {
      id = this.generateId();
      this.symbolIds.set(symbol, id);
    }

    return id;
  }

  /**
   * Encodes the given value.
   * @param {*} value
   * @returns {*} the value encoded according to the spec in the README
   */
  encode(value) {
    let refIds = null;
    let recurse;
    let encodeProp;

    encodeProp = (desc) => { // eslint-disable-line prefer-const
      if (desc.writable && desc.enumerable && desc.configurable
        && !desc.get && !desc.set) {
        return recurse(desc.value);
      }
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
    };

    recurse = (value) => { // eslint-disable-line prefer-const,no-shadow
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
          if (typeof value === 'object'
                && prototype === Array.prototype) {
            const lengthDesc = Object.getOwnPropertyDescriptor(value, 'length');
            const lengthIndex = propNames.indexOf('length');
            if (lengthDesc
                  // eslint-disable-next-line eqeqeq
                  && propNames[lengthIndex - 1] == lengthDesc.value - 1
                  && lengthDesc.value >= 0) {
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

          propNames.forEach((name) => {
            if (skipLengthProp && name === 'length') {
              return;
            }
            let desc;
            try {
              desc = Object.getOwnPropertyDescriptor(value, name);
            } catch (error) {
              if (error instanceof TypeError
                  && typeof value === 'function'
                  && name === 'caller') {
                // This works around https://github.com/brokensandals/object-graph-as-json/issues/1
                // but was only tested on Safari, and I don't fully understand what's going on.
                return;
              }
              throw error;
            }
            const newName = `.${name}`;
            result[newName] = encodeProp(desc);
          });

          propSyms.forEach((sym) => {
            let newName;
            const symBuiltinName = builtinsByValue.get(sym);
            if (symBuiltinName) {
              newName = `@${symBuiltinName}`;
            } else {
              const symId = this.internSymbol(sym);
              if (sym.description === undefined) {
                newName = `~${symId}`;
              } else {
                newName = `~${symId}|${sym.description}`;
              }
            }
            const desc = Object.getOwnPropertyDescriptor(value, sym);
            result[newName] = encodeProp(desc);
          });

          return result;
        }
        default:
          return { type: 'unknown', typeof: type };
      }
    };

    return recurse(value);
  }
}
