# ponytail: lazy heuristic Q&A for Bahasa Indonesia notes.
# Strategy: split text into sentences, then for each "fact-looking" sentence
# (contains a number/year/dates or "adalah/merupakan/yaitu"), build a question
# by removing a key term. Fallback: cloze the longest noun-phrase.
import re

_SPLIT = re.compile(r"(?<=[\.\!\?])\s+")
_NUM = re.compile(r"\b\d{2,4}\b")  # years, numbers
_FACT_CUES = re.compile(r"\b(adalah|merupakan|yaitu|sebab|karena|sehingga)\b", re.IGNORECASE)


def _key_terms(sentence: str) -> list[str]:
    # ponytail: cheap extraction — capitalized words and numbers first, then content words.
    caps = re.findall(r"\b[A-Z][a-zA-Z]{2,}\b", sentence)
    nums = _NUM.findall(sentence)
    words = re.findall(r"\b[a-zA-ZÀ-ɏ]{5,}\b", sentence)
    return list(dict.fromkeys(nums + caps + words))  # dedupe, preserve order


def _make_question(sentence: str, term: str) -> tuple[str, str]:
    # ponytail: hide the term with a blank, answer = the term.
    q = re.sub(rf"\b{re.escape(term)}\b", "____", sentence, count=1)
    return q.strip().rstrip(".") + "?", term


def generate(text: str) -> list[dict]:
    """Return list of {question, answer} pairs."""
    sentences = [s.strip() for s in _SPLIT.split(text) if len(s.strip()) > 15]
    pairs: list[dict] = []
    for s in sentences:
        terms = _key_terms(s)
        if not terms:
            continue
        # prefer sentences that look like facts
        if _NUM.search(s) or _FACT_CUES.search(s):
            term = terms[0]
        else:
            # fallback: pick the longest term
            term = max(terms, key=len)
        q, a = _make_question(s, term)
        pairs.append({"question": q, "answer": a})
    # ponytail: cap to avoid spam; raise when real content scales up.
    return pairs[:50]