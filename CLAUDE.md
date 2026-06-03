# Economic Bomb - Bot Style Rules

## No emojis in slash command choice names
Command choices (the `name` field in `addChoices(...)`) must never include emojis.
The emoji can stay in data objects (CRIMES, LOCATIONS, etc.) for embed use, but not in the Discord slash command option list.

Bad:  `{ name: '💳 Fraud', value: 'fraud' }`
Good: `{ name: 'Fraud',    value: 'fraud' }`

Emojis ARE allowed everywhere else: button labels, embed titles, embed descriptions, footer text, field names, etc. Only `addChoices` name fields are restricted.

## No em-dashes
Never use em-dashes (—) anywhere in bot output, embed text, footers, or descriptions.
Use a plain hyphen-minus (-) instead.

Bad:  `'High risk, high reward — commit a crime'`
Good: `'High risk, high reward - commit a crime'`

## No section header comments
Never add decorative section separator comments. No banner-style dividers with dashes, box-drawing characters, or padding.

Bad:  `// ── Blackjack ─────────────────────────────────────────────────────────`
Good: no comment — the `if (game === 'blackjack')` line is self-documenting
