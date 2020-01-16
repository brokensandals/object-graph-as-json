import { builtinsByName } from './builtins';

export class Decoder {
  onFailure(value, message) {
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
        return this.decodeOther(value, context);
    }
  }

  decodeBuiltin(value, { idMap }) {
    if (!value.name) {
      return this.onFailure(value, 'builtin is missing name');
    }

    const builtin = builtinsByName.get(value.name);
    if (builtin === undefined && value.name !== 'undefined') {
      return this.onFailure(value, `unrecognized builtin name [${value.name}]`);
    }

    return builtin;
  }

  decodeBigint(value, { idMap }) {
    if (!value.string) {
      return this.onFailure(value, 'bigint is missing string');
    }

    try {
      return BigInt(value.string);
    } catch (err) {
      return this.onFailure(value, `error parsing bigint [${value.string}]: ${err}`);
    }
  }

  decodeSymbol(value, { idMap, seenIdSet }) {
    if (!value.id) {
      return this.onFailure(value, 'symbol is missing id');
    }

    const existing = idMap.get(value.id);
    if (existing) {
      if (existing.description !== value.description) {
        return this.onFailure(value,
          `symbol with id [${value.id}] has different description [${value.description}] than existing symbol with that id [${existing.description}]`);
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
      return this.onFailure(value, 'array is missing id');
    }

    if (value['prototype']) {
      return this.onFailure(value, `array with id [${value.id}] has prototype property which should have been implied`);
    }

    if (value['.length']) {
      return this.onFailure(value, `array with id [${value.id}] has .length property which should have been implied`);
    }

    return decodeOntoObject(value, [], context);
  }

  decodeOntoObject(value, target, context) {
    const { idMap, seenIdSet } = context;

    if (seenIdSet.has(value.id)) {
      return this.onFailure(value, `id [${value.id}] has already been seen on another array, function, or object`);
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
        if (typeof builtin !== 'symbol') {
          const failure = onFailure(key, `property key [${key}] did not correspond to a symbol`);
          const failureKey = Symbol(`failure to decode key ${key}`);
          Object.defineProperty(target, failureKey, {
            writable: true,
            enumerable: true,
            configurable: true,
            value: failure,
          });
          targetKey = Symbol(`failed to decode key ${key}`);
        }
        targetKey = builtin;
      } else if (key.startsWith('<')) {
        const parts = key.slice(1).split('>');
        if (parts.length !== 2 || parts[0].length < 1) {
          const failure = onFailure(key, `property key [${key}] should follow format: <id>description`);
          // TODO
        }
        // TODO
      }
    }
  }
}
