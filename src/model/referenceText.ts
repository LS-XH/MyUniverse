/** Render a stored instance reference as its readable label, without its JSON-only suffix. */
export function referenceText(value:string):string {
 return value.replace(/^\[([^\]\n]*)\]\([^\n)]+\.md#[^\n)]+\)(?:\s*\[[^\n]*\]\([^\n]+\)@[\w-]+)?$/i,'$1')
}
