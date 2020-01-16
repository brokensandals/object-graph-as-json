import { builtinsByName } from './builtins';

export class UnsafeDecoder {
  onFailure(value, message, context) {
    throw new Error(message);
  }

  onKeyFailure(container, key, message, context) {
    throw new Error(message);
  }

  decode(value, context = {}) {
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    if (!context.idMap) {
      context.idMap = new Map();
    }
    if (!context.seenIdSet) {
      context.seenIdSet = new Set();
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
    const { idMap } = context;

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
    const { idMap, seenIdSet } = context;

    if (!value.id) {
      return this.onFailure(value, 'symbol is missing id', context);
    }

    const existing = idMap.get(value.id);
    if (existing) {
      if (existing.description !== value.description) {
        return this.onFailure(value,
          `symbol with id [${value.id}] has different description [${value.description}] than existing symbol with that id [${existing.description}]`, context);
      }
      return existing;
    }

    const sym = Symbol(value.description);
    idMap.set(value.id, sym);
    seenIdSet.add(value.id);
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
    const { idMap, seenIdSet } = context;

    if (seenIdSet.has(value.id)) {
      return this.onFailure(value, `id [${value.id}] has already been seen on another array, function, or object`, context);
    }

    seenIdSet.add(value.id);
    idMap.set(value.id, target);

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
    const { idMap, seenIdSet } = context;

    if (!value.id) {
      return this.onFailure(value, 'ref is missing id', context);
    }

    if (!seenIdSet.has(value.id)) {
      return this.onFailure(value, `id [${value.id}] was first encountered on a ref`, context);
    }

    const target = idMap.get(value.id);
    if (!target) {
      return this.onFailure(value, `ref id [${value.id}] not found in idMap`, context);
    }

    return target;
  }
}