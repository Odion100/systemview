::gap{id=G-13 from="spec-maintenance walk of RFC-075, 2026-11-08"}

# RFC-074 lost two claims from under an approved completeness verdict, silently

RFC-075 carries a tripwire: *"Every proofless claim in RFC-073 and RFC-074 still parses as a claim —
61 of them, not one broken"* — a hard-coded count built so that a claim vanishing from either
document goes red. On 2026-11-08 it read **59**, and the walk traced the two.

**RFC-074's c9 and c15 were deleted by commit `d2bf2d6c` (2026-11-02)** — a commit whose subject is
RFC-076 retention planning and whose message says nothing about them. They were the only two
UNMARKED claims in RFC-074's list, and they sat under an approval block already reading
`verdict=approved` on the question *"Is this the complete list of claims for RFC-074?"* No
supersession note, no replacement, no decision on the record. A frozen contract got quietly two
claims shorter, in a commit about something else.

The second opinion that ruled this (blind, 2026-11-08) called it the cheap-edit pattern this
system's authority rule exists to catch: editing a document is cheaper than doing the work it
promises, so a deletion with no decision behind it is DRIFT against the contract, not an amendment.

## What resolves it — one of two, on the record

- **Restore c9 and c15** to RFC-074 as they were at approval (`git show d2bf2d6c^ --
  RFCs/RFC-074-karaoke.md` has them verbatim), or
- **Decide their removal**: a supersession note on the approval block (or the claims' own ids)
  saying who removed them and why — the same dated-note form RFC-075 uses for its superseded
  claims.

Until one happens, RFC-075's L357 tripwire stays red **on purpose** — it is the one spec in that
document whose red is the finding, and re-pinning it to 59 would be erasing the evidence.

::test[Test.Proofs.leavesInTheOtherRfcsStillParse]{project=systemview-test}
