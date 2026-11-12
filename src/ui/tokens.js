// Player token silhouettes — mirrors the four 3D token meshes (top hat, roadster,
// battleship, pawn). One consistent filled style, tinted with the player color.

const TOKEN_PATHS = {
  hat: `
    <path d="M7.2 17.5c-.1-4.6.9-9.7 2.2-11.3a1 1 0 0 1 .8-.4h3.6a1 1 0 0 1 .8.4c1.3 1.6 2.3 6.7 2.2 11.3z"/>
    <path d="M3.5 18.5h17a1.2 1.2 0 0 1 0 2.4h-17a1.2 1.2 0 0 1 0-2.4z"/>`,
  car: `
    <path d="M3 15.2l1.3-4.1A2 2 0 0 1 6.2 9.7h8a3 3 0 0 1 2.4 1.2l1.9 2.6h1.4a1.6 1.6 0 0 1 1.6 1.6v1.7a1 1 0 0 1-1 1h-1.1a2.4 2.4 0 0 1-4.6 0h-5.1a2.4 2.4 0 0 1-4.6 0H4a1 1 0 0 1-1-1z"/>
    <circle cx="7.4" cy="17.8" r="1.5"/>
    <circle cx="16.6" cy="17.8" r="1.5"/>`,
  ship: `
    <path d="M12.5 3.5h1.6v7h-1.6z"/>
    <path d="M12 4.5l-6 5.5h6z"/>
    <path d="M3.5 13.5h17l-2.3 4.6a2 2 0 0 1-1.8 1.1H7.6a2 2 0 0 1-1.8-1.1z"/>`,
  pawn: `
    <circle cx="12" cy="6.3" r="2.6"/>
    <path d="M9.9 9.8h4.2l1.7 7.4H8.2z"/>
    <path d="M6.2 18.4h11.6a1.5 1.5 0 0 1 0 3H6.2a1.5 1.5 0 0 1 0-3z"/>`
};

/**
 * Inline SVG for a player token piece.
 * @param {string} key  'hat' | 'car' | 'ship' | 'pawn'
 * @param {string} color fill color (player color)
 * @param {number} size  rendered square size in px
 */
export function tokenSVG(key, color, size = 18) {
  const paths = TOKEN_PATHS[key] || TOKEN_PATHS.pawn;
  return `<svg class="token-svg" width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="${color}" aria-hidden="true" focusable="false">${paths}</svg>`;
}
