# Synthetic data contract

## Provenance

The repository contains no ticket dataset. `generateTickets()` creates a fixed public simulation in the browser from:

- seed: `20260814`;
- rows: `100000`;
- snapshot end: `2026-08-13`;
- observation window: 180 days.

The names Atlas, Beacon, Comet, and Delta are fictional team labels. Categories and channel values are generic product dimensions. The generator is a clean-room implementation created for this repository.

## Row schema

| Field | Type | Allowed values / constraint | Meaning |
|---|---|---|---|
| `id` | string | `SO-` + six digits | generated ticket key |
| `day` | integer | 0–179 | zero-based position in the snapshot |
| `date` | ISO date | 180-day window | ticket creation date |
| `team` | enum | Atlas, Beacon, Comet, Delta | fictional handling team |
| `category` | enum | Access, Billing, Playback, Profile | issue family |
| `channel` | enum | Chat, Email, Phone | contact channel |
| `firstResponseMinutes` | integer | ≥ 1 | minutes to first response |
| `resolutionMinutes` | integer | positive | minutes to final resolution |
| `csat` | number | 1.0–5.0, one decimal | synthetic satisfaction score |
| `firstContactResolved` | boolean | true / false | resolved on first contact |
| `reopened` | boolean | true / false | reopened after initial handling |

Identity fields are intentionally impossible in this schema. There is no customer, agent, supervisor, name, email, phone, account, free-text message, or external identifier.

## Generator model

The seeded generator combines documented factors to create useful but fictional patterns:

- weighted team, category, and channel mix;
- category and team response-time offsets;
- a weekend response penalty;
- a modest improvement in the latest 60 days;
- FCR and reopen probabilities;
- resolution and CSAT relationships driven by response, FCR, and reopen outcomes.

These relationships exist so a reviewer can find and verify operational signals. They do not model a named company and must not be used as real-world benchmarks.

## Aggregation rules

| Measure | Formula | Empty-slice behavior |
|---|---|---|
| Volume | count of selected tickets | dashboard empty state |
| 15m SLA | `count(firstResponseMinutes <= 15) / count(*)` | suppressed |
| FCR | `count(firstContactResolved) / count(*)` | suppressed |
| CSAT | `sum(csat) / count(*)` | suppressed |
| Median resolution | middle value(s) after numeric sort | suppressed |

The comparison window has the same length immediately before the selected period. A 180-day selection has no prior window because the public snapshot intentionally contains no earlier rows.

## Privacy checks

Automated tests verify:

- the exact public key set;
- deterministic output for the same seed;
- absence of email-shaped values;
- membership in the published enums;
- exact KPI behavior on a hand-authored fixture.
