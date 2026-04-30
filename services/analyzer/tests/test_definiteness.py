"""
Unit tests for score_definiteness (A.0.6 — P3 fix).

IT fixtures (primary market) + EN fixtures (secondary).
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.scoring import score_definiteness


# ── Italian fixtures ──────────────────────────────────────────────────────────

IT_HEDGED = [
    # Multiple epistemic modals and frequency hedges
    ("Forse Visiblee potrebbe in genere migliorare la visibilità AI in qualche modo.", 12),
    # Approximation + attenuated cognitive + frequency
    ("Presumibilmente circa il 30% dei siti sembra che generalmente non compaia nelle ricerche AI.", 15),
    # Weak modals + frequency
    ("Probabilmente potrebbero a volte generalmente funzionare meglio con contenuti strutturati.", 11),
    # Multiple frequency + attenuators
    ("Di solito talvolta abbastanza spesso i risultati tendenzialmente variano.", 10),
    # Cognitive attenuated + modal
    ("Si pensa che parrebbe che in una certa misura potrebbe darsi un miglioramento.", 14),
]

IT_DEFINITE = [
    # Direct statement, no hedges
    ("Visiblee analizza la visibilità AI del tuo brand su Google AI Mode e Gemini.", 13),
    # Factual with numbers, no hedges
    ("Il 73% dei brand non compare nelle risposte AI per le query rilevanti del proprio settore.", 15),
    # Direct definition
    ("L'AI Readiness Score misura cinque dimensioni: Query Reach, Citation Power, Brand Authority, Extractability e Source Authority.", 18),
    # Imperative/action-oriented
    ("Aggiungi le tue query target, avvia l'analisi e ottieni un piano di ottimizzazione concreto.", 14),
    # Factual assertion
    ("Il modello analizza i passaggi estratti dal contenuto e calcola un punteggio composito ponderato.", 14),
]


# ── English fixtures ──────────────────────────────────────────────────────────

EN_HEDGED = [
    # Modal hedges + frequency
    ("Perhaps Visiblee might sometimes generally improve AI visibility in some way.", 12),
    # Approximation + cognitive + frequency
    ("Probably around 30% of websites usually seems to appear in AI search results.", 13),
    # Weak modals + attenuators
    ("It appears that could rather fairly often tend to work better with structured content.", 14),
    # Multiple hedges
    ("Maybe it would sometimes usually approximately help to optimize your content.", 12),
    # Cognitive + modal
    ("It seems that possibly sometimes the results could somewhat vary.", 11),
]

EN_DEFINITE = [
    # Direct statement
    ("Visiblee measures AI visibility across Google AI Mode, AI Overviews, and Gemini.", 13),
    # Factual with numbers
    ("73% of brands do not appear in AI responses for their most relevant industry queries.", 15),
    # Direct definition
    ("The AI Readiness Score evaluates five dimensions: Query Reach, Citation Power, Brand Authority, Extractability, and Source Authority.", 20),
    # Action-oriented
    ("Add your target queries, run the analysis, and receive a concrete optimization plan.", 14),
    # Factual assertion
    ("The model extracts passages from your content and computes a weighted composite score.", 14),
]


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_it_hedged_below_threshold():
    for text, wc in IT_HEDGED:
        score = score_definiteness(text, wc, language="it")
        assert score < 0.4, f"Expected < 0.4 for hedged IT, got {score!r} for: {text!r}"


def test_it_definite_above_threshold():
    for text, wc in IT_DEFINITE:
        score = score_definiteness(text, wc, language="it")
        assert score > 0.85, f"Expected > 0.85 for definite IT, got {score!r} for: {text!r}"


def test_en_hedged_below_threshold():
    for text, wc in EN_HEDGED:
        score = score_definiteness(text, wc, language="en")
        assert score < 0.4, f"Expected < 0.4 for hedged EN, got {score!r} for: {text!r}"


def test_en_definite_above_threshold():
    for text, wc in EN_DEFINITE:
        score = score_definiteness(text, wc, language="en")
        assert score > 0.85, f"Expected > 0.85 for definite EN, got {score!r} for: {text!r}"


def test_empty_text_returns_perfect_score():
    assert score_definiteness("", 0, "it") == 1.0
    assert score_definiteness("", 0, "en") == 1.0


def test_saturation_at_five_hedges():
    # 5+ hedge words should saturate to 0.0
    text = "Forse probabilmente potrebbe magari eventualmente funzionare."
    score = score_definiteness(text, 7, "it")
    assert score == 0.0, f"Expected 0.0 at saturation, got {score!r}"


def test_word_boundary_no_false_positive():
    # "forsennato" contains "forse" but must not match
    text = "Il forsennato ritmo del mercato richiede analisi continue."
    score = score_definiteness(text, 10, "it")
    assert score == 1.0, f"Expected 1.0 (no false positive), got {score!r}"


def test_language_fallback_uses_en():
    # Unknown language falls back to EN list
    text = "Perhaps this might work."
    score_unknown = score_definiteness(text, 5, "fr")
    score_en = score_definiteness(text, 5, "en")
    assert score_unknown == score_en
