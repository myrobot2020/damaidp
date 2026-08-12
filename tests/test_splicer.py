import pytest
import sys
from pathlib import Path

# Add parent dir to path so we can import pipeline
sys.path.append(str(Path(__file__).resolve().parent.parent))
import pipeline

def test_numerise():
    """Verify word-numbers are converted to digits correctly."""
    text = "Sutta five point four point forty"
    assert pipeline.numerise(text) == "Sutta 5 point 4 point 40"

    text = "Book five y point z"
    assert pipeline.numerise(text) == "Book 5 y point z"

    text = "One two three"
    assert pipeline.numerise(text) == "1 2 3"

def test_find_segment_with_title_hint():
    """Verify segment detection using title hint and numerise."""
    cues = [
        (0.0, 5.0, "Intro music"),
        (5.0, 10.0, "Welcome to the talk"),
        (10.0, 15.0, "We are starting with Sutta five point four point forty"),
        (15.0, 20.0, "This is the body of the teaching"),
        (20.0, 25.0, "End of the sutta"),
        (25.0, 30.0, "Now Sutta 5.4.41 starts")
    ]

    # Target ID: 5_4_40
    # Title Hint: "Book 5 Talk"
    start, end, text = pipeline.find_segment(cues, "5_4_40", "Book 5 Talk")

    assert start == 10.0
    assert end == 25.0
    assert "body of the teaching" in text

def test_find_segment_fallback_loose():
    """Verify loose matching if pattern search fails."""
    cues = [
        (10.0, 15.0, "Let us look at teaching five four forty"),
        (15.0, 20.0, "Actual content here"),
        (20.0, 25.0, "Five . 4 . 41")
    ]

    # Target ID: 5_4_40
    # Numbers "5", "4", "40" exist but not as "5.4.40"
    start, end, text = pipeline.find_segment(cues, "5_4_40", "Random Title")

    assert start == 10.0
    assert "Actual content" in text
