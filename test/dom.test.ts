import { describe, expect, it } from 'vitest';

import { el, feedbackArea } from '../src/dom';

describe('the shared DOM helpers', () => {
  it('builds an element with an optional class and text', () => {
    const node = el('span', 'choice-word', 'Today');
    expect(node.tagName).toBe('SPAN');
    expect(node.className).toBe('choice-word');
    expect(node.textContent).toBe('Today');
  });

  it('leaves the class and text alone when they are not given', () => {
    const node = el('div');
    expect(node.className).toBe('');
    expect(node.textContent).toBe('');
  });

  it('shows the last verdict in #feedback', () => {
    expect(feedbackArea('correct').querySelector('#feedback')?.textContent).toBe('✓ Got it!');
    expect(feedbackArea('wrong').querySelector('#feedback')?.textContent).toContain('Not yet');
    expect(feedbackArea().querySelector('#feedback')?.textContent).toBe('');
  });
});
