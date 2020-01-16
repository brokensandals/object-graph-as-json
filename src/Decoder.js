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

  decodeSymbol(value, { idMap }) {
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
    return sym;
  }
}
