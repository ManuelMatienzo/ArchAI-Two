import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidUmlMultiplicity } from '../src/components/canvas/umlMultiplicity.ts';

test('acepta cardinalidades UML habituales y rangos personalizados', () => {
  for (const value of ['', '0', '1', '*', '0..1', '1..*', '2..5', '0..*']) {
    assert.equal(isValidUmlMultiplicity(value), true, value);
  }
});

test('rechaza multiplicidades incorrectas y rangos invertidos', () => {
  for (const value of ['-1', 'a', '1..', '..*', '3..2', '1.2', '*..1']) {
    assert.equal(isValidUmlMultiplicity(value), false, value);
  }
});
