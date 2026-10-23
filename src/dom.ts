/**
 * DOM helpers shared by the screens.
 *
 * A screen builds its elements with `el` rather than a framework, and the feedback area is the same
 * on every task: the adult's last verdict stays in `#feedback` until the next one.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function feedbackArea(lastVerdict?: 'correct' | 'wrong'): HTMLElement {
  const area = el('div', 'feedback-area');
  const feedback = el('div');
  feedback.id = 'feedback';
  if (lastVerdict === 'correct') feedback.textContent = '✓ Got it!';
  if (lastVerdict === 'wrong') feedback.textContent = 'Not yet — have another go';
  area.append(feedback);
  return area;
}
