# Deck loading recovery — v2.5.22-beta

- Initial private deck-usage sync now counts only successful decks as completed.
- Archidekt request network/timeout errors are retried, not only HTTP 429/5xx responses.
- Failed decks receive up to 3 automatic recovery rounds with cooldowns (4s, 8s, 15s) and lower retry concurrency.
- Manual `↻ Recargar mazos` remains available after an incomplete load.
- Sync polling no longer leaves a timer running when the sync already completed from cache.
- Final catalog refresh is performed once per sync completion instead of repeatedly.
- Public deck-size prefetch also retries missing decks in background.
- LAB and Improve share the same initial deck catalog, disk deck cache, session usage state and `/api/deck-detail` cache. LAB only adds the metrics calculation after selection.
