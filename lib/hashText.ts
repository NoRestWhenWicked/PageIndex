/** FNV-1a hash — shared by the art UI, the runtime endpoint, and the
 * build-time generator so they all key card art identically. */
export function hashText(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
