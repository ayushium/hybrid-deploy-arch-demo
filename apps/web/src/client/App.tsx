import { Phone } from './Phone.js';
import { Wall } from './Wall.js';

/**
 * Two views off the same data:
 *   /      → client view: eleven buttons, nothing else
 *   /wall  → display view: the feed + the per-instance activity meter
 */
export function App() {
  return window.location.pathname.startsWith('/wall') ? <Wall /> : <Phone />;
}
