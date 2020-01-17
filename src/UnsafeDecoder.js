import { builtinsByName } from './builtins';

/**
 * Takes an object graph encoded according to the spec in the README, and attempts
 * to decode it back into javascript objects that are equivalent to the originals.
 * 
 * This is **UNSAFE** because, in order to recreate function objects, it evaluates
 * code contained in the encoded objects. Don't use it unless you are 100% sure you
 * trust the encoded objects! Just decoding them is dangerous, even if you never
 * call the resulting functions! The decoder also follows the encoded objects' instructions
 * to do things like set prototypes, define accessors, and set properties using well-known
 * symbol keys, all of which could be manipulated to cause the resulting objects to behave
 * in ways you might not be expecting, if you aren't careful.
 * 
 * Usage:
 *   const decoder = new Decoder();
 *   const result = decoder.decode(myEncodedObject);
 * 
 * The instance of Decoder remembers symbol IDs that it has seen before, and will decode them
 * to the same Symbols each time. Other types of objects are _not_ reused across calls to decode().
 * 
 * If invalid data is detected, by default an error is thrown. You can override onFailure() and onKeyFailure()
 * to change this behavior.
 * 
 * In the future, this should probably be supplemented by or replaced with a class that
 * merely wraps the encoded graph and lets you access/traverse the parts you're interested in,
 * without actually trying to recreate the original objects unless requested. But for now,
 * if you need safer decoding, consider overriding the decodeFunction(), decodePrototypeOntoObject(),
 * decodePropertiesOntoObject(), and decodePropertyValue() methods.
 */
export default class UnsafeDecoder {
  constructor() {
    this.symbolsById = new Map();
  }

  /**
   * This is called when decoding some part of the encoded graph fails. By default it
   * simply throws an error. You can override it to fail gracefully. The return value
   * will be inserted directly into the output at the point where the decoded value
   * would have gone. Decoding will not be applied to the returned value.
   * 
   * If value.type === 'property', the return value should be a javascript property descriptor,
   * or can be `undefined` to indicate the property should be omitted from the result object.
   * @param {*} value the encoded value that failed to decode
   * @param {*} message a description of the error
   * @param {*} context for passing to recursive calls to decode()
   * @returns {*} whatever you want to appear in the resulting object graph instead place of the decoded value
   */
  onFailure(value, message, context) {
    throw new Error(message);
  }

  /**
   * This is called when decoding one of the keys of an object/array/function fails. By default
   * it simply throws an error. You can override it to fail gracefully. The return value should be
   * a string or symbol to use as the key instead of the decoded value, or `undefined` to indicate
   * this property should be omitted from the result object.
   * 
   * Scenarios in which this might be called:
   * - A key tries to refer to a well-known symbol, but the decoder doesn't recognize that symbol
   * - A key refers to a symbol by ID, but the description doesn't match the previously seen description
   *     for that symbol
   * - A key is formatted like `"~|foo"`, where the symbol ID is missing
   * @param {*} container the encoded object/array/function containing this property key
   * @param {*} key the encoded property key (such as `"@Something"` or `"~2|something"`)
   * @param {*} message 
   * @param {*} context 
   * @returns {undefined|string|Symbol} whatever you want to use as the key for this property
   */
  onKeyFailure(container, key, message, context) {
    throw new Error(message);
  }

  /**
   * Builds a graph of javascript objects from a graph encoded according to the spec in the README.
   * @param {*} value the top-level value of the encoded graph
   * @param {*} context used in recursive decoding; omit when calling from outside this class
   * @returns {*} the decoded value
   */
  decode(value, context = {}) {
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    if (!context.objectsById) {
      context.objectsById = new Map();
    }

    switch (value.type) {
      case 'builtin':
        return this.decodeBuiltin(value, context);
      case 'bigint':
        return this.decodeBigint(value, context);
      case 'symbol':
        return this.decodeSymbol(value, context);
      case 'array':
        return this.decodeArray(value, context);
      case 'function':
        return this.decodeFunction(value, context);
      case 'object':
        return this.decodeObject(value, context);
      case 'ref':
        return this.decodeRef(value, context);
      default:
        return this.onFailure(value, `unknown type [${value.type}]`, context);
    }
  }

  decodeBuiltin(value, context) {
    if (!value.name) {
      return this.onFailure(value, 'builtin is missing name', context);
    }

    const builtin = builtinsByName.get(value.name);
    if (builtin === undefined && value.name !== 'undefined') {
      return this.onFailure(value, `unrecognized builtin name [${value.name}]`, context);
    }

    return builtin;
  }

  decodeBigint(value, context) {
    if (!value.string) {
      return this.onFailure(value, 'bigint is missing string', context);
    }

    try {
      return BigInt(value.string);
    } catch (err) {
      return this.onFailure(value, `error parsing bigint [${value.string}]: ${err}`, context);
    }
  }

  decodeSymbol(value, context) {
    const { objectsById } = context;

    if (!value.id) {
      return this.onFailure(value, 'symbol is missing id', context);
    }

    const existing = this.symbolsById.get(value.id);
    if (existing) {
      if (existing.description !== value.description) {
        return this.onFailure(value,
          `symbol with id [${value.id}] has different description [${value.description}] than existing symbol with that id [${existing.description}]`, context);
      }
      return existing;
    }

    const sym = Symbol(value.description);
    objectsById.set(value.id, sym);
    this.symbolsById.set(value.id, sym);
    return sym;
  }

  decodeArray(value, context) {
    if (!value.id) {
      return this.onFailure(value, 'array is missing id', context);
    }

    if (value['prototype']) {
      return this.onFailure(value, `array with id [${value.id}] has prototype property which should have been implied`, context);
    }

    if (value['.length']) {
      return this.onFailure(value, `array with id [${value.id}] has .length property which should have been implied`, context);
    }

    return this.decodeOntoObject(value, [], context);
  }

  decodeFunction(value, context) {
    if (!value.id) {
      return this.onFailure(value, 'function is missing id', context);
    }

    if (!value.source) {
      return this.onFailure(value, `function with id [${value.id}] is missing source`, context);
    }

    const wrapper = `return (${value.source});`;
    let fn;
    try {
      fn = (new Function(wrapper))();
    } catch (err) {
      return this.onFailure(value, `function with id [${value.id}] could not be constructed: ${err}`, context);
    }

    return this.decodeOntoObject(value, fn, context);
  }

  decodeObject(value, context) {
    if (!value.id) {
      return this.onFailure(value, 'object is missing id', context);
    }

    return this.decodeOntoObject(value, {}, context);
  }

  decodeOntoObject(value, target, context) {
    const { objectsById } = context;

    if (objectsById.has(value.id)) {
      return this.onFailure(value, `id [${value.id}] has already been seen on another array, function, or object`, context);
    }

    objectsById.set(value.id, target);

    if (value.prototype !== undefined) {
      target = this.decodePrototypeOntoObject(value, target, context);
    }

    target = this.decodePropertiesOntoObject(value, target, context);

    return target;
  }

  decodePrototypeOntoObject(value, target, context) {
    if (value.prototype !== undefined) {
      Object.setPrototypeOf(target, this.decode(value.prototype, context));
    }
    return target;
  }

  decodePropertiesOntoObject(value, target, context) {
    for (const key of Object.keys(value)) {
      let targetKey;
      if (key.startsWith('.')) {
        targetKey = key.slice(1);
      } else if (key.startsWith('@')) {
        const name = key.slice(1);
        const builtin = this.decodeBuiltin({ type: 'builtin', name }, context);
        if (typeof builtin === 'symbol') {
          targetKey = builtin;
        } else {
          targetKey = this.onKeyFailure(value, key, `key [${key}] does not refer to a symbol`);
        }
      } else if (key.startsWith('~')) {
        const idEnd = key.indexOf('|');
        if (idEnd === 1) {
          targetKey = this.onKeyFailure(value, key, `key [${key}] is missing id`);
        }
        else {
          const fake = { type: 'symbol' };
          if (idEnd > 1) {
            fake.description = key.slice(idEnd + 1);
            fake.id = key.slice(1, idEnd);
          } else {
            fake.id = key.slice(1);
          }
          const sym = this.decodeSymbol(fake, context);
          if (typeof sym === 'symbol') {
            targetKey = sym;
          } else {
            targetKey = this.onKeyFailure(value, key, `key [${key}] does not refer to a symbol`);
          }
        }
      }

      // In case targetKey was set to the result of onKeyFailure, make sure it's
      // something we can use.
      if (targetKey === undefined) {
        continue;
      }
      if (typeof targetKey !== 'string' && typeof targetKey !== 'symbol') {
        throw new Error(`onKeyFailure for key [${key}] did not return undefined, string, or symbol`);
      }

      const descriptor = this.decodePropertyValue(value[key], context);
      if (descriptor !== undefined) {
        Object.defineProperty(target, targetKey, descriptor);
      }
    }

    return target;
  }

  decodePropertyValue(value, context) {
    const descriptor = {};
    if (typeof value === 'object' && value.type === 'property') {
      if (value.get === undefined && value.set === undefined) {
        if (value.value === undefined) {
          return this.onFailure(value, 'property does not have get, set, or value', context);
        }
        descriptor.value = this.decode(value.value, context);
      } else {
        if (value.value !== undefined) {
          return this.onFailure(value, 'property has both accessor and value', context);
        }
        if (value.get) {
          descriptor.get = this.decode(value.get, context);
        }
        if (value.set) {
          descriptor.set = this.decode(value.set, context);
        }
      }
      if (value.configurable) {
        descriptor.configurable = true;
      }
      if (value.enumerable) {
        descriptor.enumerable = true;
      }
      if (value.writable) {
        descriptor.writable = true;
      }
    } else {
      descriptor.configurable = true;
      descriptor.enumerable = true;
      descriptor.writable = true;
      descriptor.value = this.decode(value, context);
    }
    return descriptor;
  }

  decodeRef(value, context) {
    const { objectsById } = context;

    if (!value.id) {
      return this.onFailure(value, 'ref is missing id', context);
    }
    
    const target = objectsById.get(value.id);
    if (!target) {
      return this.onFailure(value, `id [${value.id}] was first encountered on a ref`, context);
    }

    return target;
  }
}
