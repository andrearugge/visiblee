from __future__ import annotations

"""
Hedge word lists for score_definiteness (P3 fix).

IT is the primary market. EN is secondary.
Match case-insensitive with word boundaries to avoid false positives
(e.g. "forse" should not match inside "forsennato").

Source: docs/_archive/consultant-analysis-2026-04.md
Tuning note: review after 3 months of production data.
"""

# Italian — primary
HEDGE_WORDS_IT: list[str] = [
    # Epistemic modals
    "forse", "magari", "eventualmente", "presumibilmente",
    "probabilmente", "apparentemente",
    # Weak modals
    "potrebbe", "potrebbero", "può darsi", "potrebbe darsi",
    # Imprecise frequency
    "a volte", "talvolta", "spesso", "qualche volta",
    "di solito", "generalmente", "in genere", "normalmente",
    "tipicamente", "tendenzialmente",
    # Approximation
    "circa", "all'incirca", "pressappoco", "intorno a",
    # Attenuated cognitives
    "pare che", "sembra che", "sembrerebbe", "parrebbe",
    "si direbbe", "si pensa che", "si ritiene che",
    # Attenuators
    "piuttosto", "abbastanza", "alquanto",
    "in qualche modo", "in una certa misura",
]

# English — secondary
HEDGE_WORDS_EN: list[str] = [
    # Modal hedges
    "perhaps", "maybe", "possibly", "presumably",
    "probably", "apparently", "supposedly",
    # Weak modals (epistemic)
    "could", "might", "may", "would",
    # Frequency
    "sometimes", "often", "usually", "generally",
    "typically", "tends to", "tend to",
    # Approximation
    "roughly", "about", "around", "approximately",
    "nearly", "almost",
    # Cognitive hedges
    "seems", "appears", "looks like",
    "it seems that", "it appears that",
    # Attenuators
    "somewhat", "rather", "fairly",
    "kind of", "sort of",
]


def get_hedge_words(language: str) -> list[str]:
    """Return the hedge word list for the given ISO 639-1 language code."""
    if language.lower().startswith("it"):
        return HEDGE_WORDS_IT
    return HEDGE_WORDS_EN
