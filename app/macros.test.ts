import { assert as emberAssert } from '@ember/debug';
import { isTesting, setTesting } from '@embroider/macros';
import { describe, expect, test } from 'vitest';

describe('@embroider/macros | runtime mode in tests', () => {
  /**
   * In compile-time mode `isTesting()` is inlined as `false` at build time,
   * regardless of what the runtime global config says. Only when the test
   * build runs the macros plugin in runtime mode (see babel.config.js +
   * VITEST) does `isTesting()` reflect the value set by `setTesting(true)`.
   */
  test('isTesting() reflects setTesting(true)', () => {
    setTesting(true);
    expect(isTesting()).toBe(true);
  });

  /**
   * `@ember/debug`'s `assert(description, condition)` is only active when
   * DEBUG is true (i.e. non-production builds). Assertions are stripped
   * from production bundles, so this also doubles as a sanity check that
   * the test environment keeps DEBUG enabled.
   */
  test('@ember/debug assert throws when the condition is false', () => {
    expect(() => emberAssert('string', false)).toThrow();
  });
});
