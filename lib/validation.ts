// Game name: 3–16 chars, Unicode letters + digits + spaces + underscores + periods
const GAME_NAME_REGEX = /^[\p{L}\p{N} _.]{3,16}$/u
// Tagline: 3–5 alphanumeric chars only
const TAG_LINE_REGEX = /^[A-Za-z0-9]{3,5}$/

export function validateGameName(name: string): boolean {
  return GAME_NAME_REGEX.test(name)
}

export function validateTagLine(tag: string): boolean {
  return TAG_LINE_REGEX.test(tag)
}

/**
 * Parses "Name#Tag" or "Name #Tag" format.
 * Uses lastIndexOf to handle game names that contain '#' (not valid per Riot spec,
 * but defensive parsing).
 */
export function parseRiotId(
  input: string,
): { gameName: string; tagLine: string } | null {
  const hashIndex = input.lastIndexOf('#')
  if (hashIndex === -1) return null
  const gameName = input.slice(0, hashIndex).trim()
  const tagLine = input.slice(hashIndex + 1).trim()
  if (!gameName || !tagLine) return null
  return { gameName, tagLine }
}
