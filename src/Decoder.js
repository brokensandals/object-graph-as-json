import { builtinsByName } from './builtins';

export class Decoder {
  onFailure(value, message) {
    throw new Error(message);
  }

  decode(value, options = {}) {
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    if (!options.idMap) {
      options.idMap = new Map();
    }

    switch (value.type) {
      case 'builtin':
        return this.decodeBuiltin(value, options);
      case 'bigint':
        return this.decodeBigint(value, options);
      case 'symbol':
        return this.decodeSymbol(value, options);
      case 'array':
        return this.decodeArray(value, options);
      case 'function':
        return this.decodeFunction(value, options);
      case 'object':
        return this.decodeObject(value, options);
      case 'ref':
        return this.decodeRef(value, options);
      default:
        return this.decodeOther(value, options);
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
}
