// @flow

import type { FixedCustomElementRegistry } from '../types';

import { dashCase } from './index';

export function formatName(prefix: string, suffix: number): string {
  prefix = prefix || 'element';
  return (
    (prefix.indexOf('-') === -1 ? `x-${prefix}` : prefix) +
    (suffix ? `-${suffix}` : '')
  );
}

export function generateName(Ctor: Function): string {
  const registry: FixedCustomElementRegistry = customElements;
  const prefix = dashCase(Ctor.name);
  let suffix: number = 0;
  while (registry.get(formatName(prefix, suffix))) {
    suffix++;
  }
  return formatName(prefix, suffix);
}
