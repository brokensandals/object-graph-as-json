export class Encoder {
  constructor() {
    this.ids = new WeakMap();
  }

  encode(value) {
    let refs = null;

    const recurse = value => {
      if (value === null) {
        return null;
      } else if (Object.is(NaN, value)) {
        return { 'type': 'builtin', 'name': 'NaN' };
      } else if (Object.is(Infinity, value)) {
        return { 'type': 'builtin', 'name': 'Infinity' };
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
          // TODO
          break;
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
