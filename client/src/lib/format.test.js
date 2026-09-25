import { describe, expect, it } from 'vitest';
import { codeLooksPresent } from './format';

describe('codeLooksPresent', () => {
  it('recognizes common code signals', () => {
    expect(codeLooksPresent('class ParkingLot { return; } const x = () => 1;')).toBe(true);
  });
  it('does not mislabel ordinary design prose', () => {
    expect(codeLooksPresent('ParkingLot owns parking tickets and delegates spot selection.')).toBe(false);
  });
});
