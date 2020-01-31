import { builtins, builtinsByName, builtinsByValue } from './builtins';

// Some sanity checks to help protect against typos.
describe('builtins', () => {
  test('no duplicate names', () => {
    expect(builtinsByName.size).toEqual(builtins.length);
  });

  test('no duplicate values', () => {
    expect(builtinsByValue.size).toEqual(builtins.length);
  });

  builtins.forEach(([value, name]) => {
    test(`${name} evalutes to correct object`, () => {
      // eslint-disable-next-line no-eval
      expect((0, eval)(name)).toBe(value);
    });
  });
});
