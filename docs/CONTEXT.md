# RiftRaven — Architecture Context

## 1. System Overview

Mobile-first League of Legends analytics platform. Fetches and processes match history via Riot API to generate player-specific performance insights. **Anonymous and multi-tenant** — no user identity stored. Profile-based tenancy: tenancy is keyed by `player_id + region`, not by user identity.

**Actors:** Anonymous User — LoL player searching any public profile. No account or login required.

**External Systems:** Riot Games Developer API — sole authoritative source for match history, player profiles, ranked standing.

---

## 2. Components

### Mobile App (React Native, Expo)
| Component | Description |
|---|---|
| Tab Navigator | Search / Favorites / Settings / (Profile via Stack) |
| Search Screen | Input + region selector. Local-first debounced queries. Falls back to Edge Function after 300–500ms debounce if no exact local match. |
| Profile Screen | Name, tag, region, ranked standing, match list, last compiled timestamp, refresh button. |
| Season Statistics Screen | Win rate, KDA, games, champion performance, queues, role distribution, sorting. |
| Favorites Screen | Lists locally saved profiles. Tap → navigate. Remove button. AsyncStorage only. |
| Settings Screen | Default region, app version, Riot Games attribution. |
| Input Validator (Client) | Game name: 3–16 chars, Unicode letters/digits/spaces/underscores/periods. Tagline: 3–5 alphanumeric. Rejects before any request. |
| AsyncStorage Service | Wrapper for reading/writing favourite profiles. Key: `riftraven_favorites`. |
| API Client | HTTPS calls to Edge Functions. |

### search-profile (Supabase Edge Function, TypeScript/Deno)
| Component | Description |
|---|---|
| Input Validator (Server) | Same rules as client. Rejects malformed immediately. |
| Profile Resolver | Calls Riot Account API to resolve Riot ID + region → PUUID. Called only after debounce and no local match. |
| Rate Limit Enforcer | 15-min per-profile cooldown + request-level rate limiting. |
| Cache Inspector | Queries `profiles` table. Returns cached data + `last_compiled_at` or signals cache miss. |
| Local Search Handler | As-you-type: queries `profiles` table by `game_name`. Instant, no Riot API call. |

### compile-profile (Supabase Edge Function, TypeScript/Deno)
| Component | Description |
|---|---|
| Lock Manager | Acquires PostgreSQL advisory lock on `player_id`. Prevents duplicate concurrent jobs. Auto-releases on disconnect. |
| Match Fetcher | Riot Match List API. Incremental: only matches newer than `last_compiled_at`. Handles pagination. |
| Match Detail Fetcher | Full match JSON per match ID. Handles retries + 429 backoff. Most quota-intensive step. |
| Analytics Calculator | Pure computation. Input: raw match participant records. Output: win rate, KDA, champion stats, role distribution (per season + queue type). |
| Persistence Writer | Writes to `matches`, `match_participants`, upserts `analytics_cache`, updates `last_compiled_at`, releases lock. |

---

## 3. Data Flows

**Flow 0 — Search as you type (local-first):**
User types → Input Validator (Client) → debounced Local Search Handler queries `profiles` table → display instantly → after 300–500ms debounce, if no exact match → search-profile Edge Function → Input Validator (Server) → Profile Resolver (Riot API) → Rate Limit Enforcer + Cache Inspector → return cached analytics or trigger compile-profile.

**Flow 1 — Profile selected, cache exists:**
Mobile → Edge Function → Query DB → Cached analytics found → Return with `last_compiled_at` timestamp → Display.

**Flow 2 — Profile selected, no cache:**
Mobile → Edge Function → No cache → Acquire PostgreSQL advisory lock on `player_id` → Fetch match list → Fetch individual matches → Calculate analytics → Store raw + compiled data → Release lock → Return analytics.

**Flow 3 — User triggers refresh:**
Mobile → Edge Function → Check `last_compiled_at` → If < 15 min: return cached + cooldown message → If ≥ 15 min: acquire lock → Fetch only newer matches → Process incrementally → Merge into existing analytics → Update timestamp → Release lock → Return.

**Favourites flow:** Favorites Screen ↔ AsyncStorage Service ↔ AsyncStorage (device-local). No server involvement.

---

## 4. Database Schema

### `profiles`
| Column | Type | Notes |
|---|---|---|
| `player_id` | VARCHAR(78) PK | Riot PUUID |
| `game_name` | VARCHAR(16) | Riot ID name |
| `tag_line` | VARCHAR(5) | Riot ID tag |
| `region` | VARCHAR(8) | e.g. EUW1, NA1 |
| `ranked_data` | JSONB | Current ranked standing per queue |
| `last_compiled_at` | TIMESTAMPTZ | Cooldown enforcement + incremental updates |
| `created_at` | TIMESTAMPTZ | First compilation |

### `matches`
| Column | Type | Notes |
|---|---|---|
| `match_id` | VARCHAR(32) | Riot match ID |
| `player_id` | VARCHAR(78) FK | → profiles |
| `match_timestamp` | TIMESTAMPTZ | Used for incremental updates |
| `game_duration` | INTEGER | Seconds |
| `queue_type` | VARCHAR(32) | e.g. RANKED_SOLO_5x5 |
| `champion_id` | INTEGER | |
| `role` | VARCHAR(16) | e.g. JUNGLE, SUPPORT |
| `win` | BOOLEAN | |
| `kills / deaths / assists` | SMALLINT | |

PK: `(match_id, player_id)`

### `match_participants`
All 10 players per match. Required for future duo stats + five-stack detection.

| Column | Type | Notes |
|---|---|---|
| `match_id` | VARCHAR(32) FK | |
| `player_id` | VARCHAR(78) | Participant PUUID |
| `game_name` | VARCHAR(16) | Display name at match time |
| `champion_id` | INTEGER | |
| `team` | SMALLINT | 100 = blue, 200 = red |
| `win` | BOOLEAN | |
| `kills / deaths / assists` | SMALLINT | |

PK: `(match_id, player_id)`

### `analytics_cache`
Pre-calculated aggregates. Fast reads without recalculation.

| Column | Type | Notes |
|---|---|---|
| `player_id` | VARCHAR(78) FK | |
| `season` | VARCHAR(16) | |
| `queue_type` | VARCHAR(32) | |
| `total_games` | INTEGER | |
| `wins` | INTEGER | |
| `champion_stats` | JSONB | `{ champion_id: { games, wins, kills, deaths, assists } }` |
| `role_distribution` | JSONB | `{ role: games }` |
| `updated_at` | TIMESTAMPTZ | |

PK: `(player_id, season, queue_type)`

---

## 5. Validation Rules

| Field | Rule | Regex |
|---|---|---|
| `game_name` | 3–16 chars, Unicode letters + digits + spaces + underscores + periods | `/^[\p{L}\p{N} _.]{3,16}$/u` |
| `tag_line` | 3–5 alphanumeric chars only | `/^[A-Za-z0-9]{3,5}$/` |

Validated client-side and server-side. Requests failing validation never reach backend.

---

## 6. Non-Functional Requirements (ISO/IEC 9126)

| Quality | Requirement | Verification |
|---|---|---|
| Functionality | All Must Have acceptance criteria pass | System testing |
| Reliability | Handles API failures, timeouts, rate limits without crash. Serves cached data regardless of API availability. | Error scenario testing |
| Usability | Usable without instruction on mobile. 2+ LoL players can search and interpret stats. | Informal usability testing |
| Efficiency | Cached profiles return < 2 sec under normal load. Incremental updates proportional to new matches only. | Performance measurement |
| Maintainability | Consistent structure, naming, separated concerns. Analytics isolated. | Code review |
| Portability | iOS + Android via Expo. Cloud-hosted Supabase. Reproducible via CI/CD. | Both platform testing |

---

## 7. Technical Decision Log

| Decision | Chosen | Rationale |
|---|---|---|
| User auth | Anonymous | Accounts don't solve IP/request-level rate limiting; all competitors allow public search |
| Refresh trigger | Manual only | Auto would compile millions of inactive profiles, wasting compute |
| Refresh cooldown | 15-min per-profile | 15 min = minimum LoL match duration; profile-level, not user-level |
| Compilation strategy | Pull-based | Push wastes compute on unwatched profiles; pull keeps costs proportional to demand |
| Match data storage | Selectively raw + analytics cache | Enables duo stats + five-stack without API re-fetch; ~1-2KB/match is negligible |
| Backend platform | Supabase | See Technology Advice Document |
| Database | PostgreSQL | Relational model suits structured analytics with foreign keys |
| Mobile framework | React Native (Expo) | See Technology Advice Document |
| Concurrent lock | PostgreSQL advisory lock | Atomic, DB-native, auto-releases on disconnect. Table-based locks have race conditions; in-memory locks don't survive across Edge Function instances. |
| Search behaviour | Local-first + debounced API fallback | Instant local results; Riot API only after 300–500ms debounce and no exact local match |
| CI/CD | GitHub Actions | Free, GitHub-integrated, supports Supabase Edge Function deployment |

---

## 8. Security Considerations

1. **API Key Security** — Riot key in Edge Function env vars only. Never in mobile bundle.
2. **Input Validation** — Both client-side and server-side. See Section 5.
3. **Rate Limiting** — 15-min per-profile cooldown + request-level limiter prevents API quota abuse.
4. **Request Locking** — Search input + refresh button disabled during in-flight requests.
5. **Data Privacy** — Only publicly available match data stored (game name, tag, PUUID). Riot ToS compliant.
6. **Transport Security** — All communication HTTPS. Supabase enforces TLS by default.

---

## 9. Key Design Rationale (Sprint 1 Notes)

- **Pull-based**: Automatic refresh rejected because compiling inactive profiles wastes compute. Resource usage must be proportional to actual demand.
- **15-min cooldown**: Grounded in game logic — 15 min is the minimum LoL match duration. No new data possible before this.
- **Raw match storage**: ~1-2KB/match. 1000 matches ≈ 1-2MB/profile. Enables future duo/five-stack without Riot API re-fetch.
- **Anonymous**: Accounts don't eliminate IP/request-level rate limiting. All competitors allow public profile search.
- **Advisory locks**: DB active requests table has race conditions at millisecond intervals. In-memory locks don't persist across Edge Function instances. Advisory locks are atomic and auto-release.
- **Local-first search**: Instant results for cached profiles. Riot API only after debounce + no exact local match.

---

## 10. MoSCoW

| Must Have | Should Have | Could Have | Won't Have |
|---|---|---|---|
| Player search + profile screen | Friends/duo stats | Performance trend analysis | Champion matchup analytics |
| Season statistics screen | Five-stack detection | UI polish + research | In-game overlays (Riot policy violation) |
| Favourites (AsyncStorage only) | | Advanced analytics insights | Composition analysis |
| Riot API integration + data pipeline | | | Desktop integration |
| Multi-tenant backend with caching | | | User accounts + auth |
| CI/CD pipeline | | | AI personalisation |

---

## 11. Sprint Schedule

| Sprint | Dates | Focus |
|---|---|---|
| 1 | Feb 23 – Mar 16 | Planning, docs, C4 architecture ✓ |
| 2 | Mar 23 – Apr 6 | Supabase setup, Riot API integration, caching, CI/CD |
| 3 | Apr 13 – May 4 | Player search/profile/season stats screens, analytics logic, 1st usability test |
| 4 | May 11 – Jun 1 | Integration tests, NFR verification, multi-tenant validation, 2nd usability test |
| 5 | Jun 8 – Jun 29 | Polish, docs finalisation, portfolio prep, endtalk |
