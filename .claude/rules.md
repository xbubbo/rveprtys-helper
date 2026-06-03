# Bot Style Rules

## No emojis in slash command choice names
Command choices (the `name` field in `addChoices(...)`) must never include emojis.
The emoji can stay in the CRIMES/LOCATIONS data objects for use in embed titles, but not in the Discord slash command option list.

Bad:  `{ name: '💳 Fraud', value: 'fraud' }`
Good: `{ name: 'Fraud',    value: 'fraud' }`

## No section header comments
Never add decorative section separator comments to code. This includes banner-style comments with box-drawing characters, dashes, or padding used purely as visual dividers.

Bad:  `// ── Blackjack ─────────────────────────────────────────────────────────`
Bad:  `// ===================== Blackjack =====================`
Good: no comment at all - the `if (game === 'blackjack')` line is self-documenting

## No em-dashes
Never use em-dashes (—) anywhere in bot output, embed text, footers, or descriptions.
Use a plain hyphen-minus (-) instead.

Bad:  `'High risk, high reward — commit a crime'`
Good: `'High risk, high reward - commit a crime'`
