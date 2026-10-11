# Concert discovery

The optional Concerts source view uses Ticketmaster Discovery v2, independently of Aède authentication. Aède remains responsible for the library graph: only its canonical principal album artists enter the lookup list. Names present in two connected origins share one lookup, with links back to each catalogue origin. Concert dates are externally attributed claims, never catalogue edits or music-tag writes.

## Explicit provider access

No lookup happens on navigation. The user first supplies a Ticketmaster developer key in Settings → External sources and explicitly starts a search. The private key stays in the existing native protected `desktop.json` configuration, outside browser preferences, account synchronization and Aède fetch overrides. IPC returns only key presence; diagnostics never interpolate the key or request URL. A missing key leaves a settings link available and search disabled. The Concerts view never contains a secret-entry form.

The native client permits only the fixed HTTPS Discovery endpoint, no redirects/proxy/Aède sessions, a 15-second request timeout and two-MiB response ceiling. Serialized requests are spaced by at least 500 ms. Authentication errors and provider throttling stop a batch; other per-artist failures remain visible while later artists can proceed. The provider covers its participating ticketing inventory, not every live event worldwide.

## Matching and progressive results

Event titles alone never identify a performer. Each retained result must contain an exact normalized performer-name match in the provider's attractions. Multiple provider IDs with that same name are refused, including across fetched pages. This prevents indiscriminate tribute/title matches; names remain less decisive than a future approved provider-ID mapping. Unknown dates/times, venue data, sale status, notices and price ranges remain explicit optional claims. Ticket links use the existing explicit HTTPS system-browser handoff.

Queries page sequentially through at most ten 100-row pages, respecting the provider's 1000-row search window. Truncation is labelled as partial. A completed artist answer is immediately retained in a device-local disposable public cache, before the next artist begins. Cancellation or closing the view retains those completed answers; one in-flight bounded native request may finish but cannot update a replaced view. Failed artist searches preserve their previous answer.

The validated cache is bounded to 200 artist answers and two MiB, expiring only oldest disposable public answers if necessary. Corrupt stores are reported and never silently replaced. Cached entries carry provider identity, retrieval time and completeness. No secret or private annotation enters this cache. Empty confirmed answers remain distinguishable from artists not yet searched.

## Verification boundaries

Fixture tests cover exact performers, ambiguous identities, partial pagination, cancellation, preserved incremental results, key privacy, removal/restart, invalid requests and corrupt-store refusal. With no user API access available, live provider dates and ticket availability cannot be accepted yet. The configured view and empty/missing-key path can still be checked natively.

Provider contract: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
