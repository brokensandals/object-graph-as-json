import { builtinsByName } from './builtins';

function defaultFailureHandler(value, message) {
  throw new Error(message);
}

export function decode(value, {
  types: {
    builtin: doBuiltin = true,
    bigint: doBigint = true,
    symbol: doSymbol = true,
    function: doFunction = true,
    object: doObject = true,
    ref: doRef = true,
  },
  onFailure = defaultFailureHandler,
} = {}) {

  const ids = new Map();
  const recurse = (value) => {
    if (typeof value !== 'object') {
      return;
    }

    switch (value.type) {
      case 'builtin':
        if (doBuiltin) {
          if (!value.name) {
            return onFailure('builtin missing name');
          }

          const target = builtinsByName.get(value.name);
          if (target === undefined && value.name !== 'undefined') {
            return onFailure(`builtin refers to unknown name ${value.name}`);
          }

          return target;
        }
        return value;
      case 'bigint':
        if (doBigint) {
          if (!value.string) {
            return onFailure('bigint missing string');
          }

          try {
            return BigInt(value.string);
          } catch (err) {
            return onFailure(`Error parsing bigint [string=${value.string}]: ${err}`);
          }
        }
        return value;
      case 'symbol':
        if (doSymbol) {
          if (!value.id) {
            return onFailure('symbol missing id');
          }
          
          const existing = ids.get(value.id);
          if (existing) {
            if (existing.description !== value.description) {
              return onFailure(`Existing symbol [${existing}] for id ${value.id} does not match description: ${value.description}`);
            }

            return existing;
          }

          const sym = Symbol(value.description);
          ids.set(value.id, sym);
        }
        return value;
      case 'array':
        if (doArray) {
          if (Object.getOwnPropertyDescriptor(value, 'prototype')) {
            return onFailure('array should not specify prototype');
          }

          const array = [];
          return handleObject(value, array);
        }
        return value;
      case 'function':
        if (doFunction) {
          // TODO
        }
        return value;
      case 'object':
        if (doObject) {
          const object = {};
          return handleObject(value, object);
        }
        return value;
      case 'ref':
        if (doRef) {
          if (!value.id) {
            return onFailure(value, 'ref missing id');
          }

          const target = ids.get(value.id);
          if (!target) {
            return onFailure(value, `ref refers to unknown id ${value.id}`);
          }

          return target;
        }
        return value;
      default:
        return onFailure(value, `unknown type: ${value.type}`);
    }
  }

  return recurse(value);
}
