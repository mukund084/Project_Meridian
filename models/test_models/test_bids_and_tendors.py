"""
Tests for the BidsAndTenders Pydantic models.

Run with:
    pytest models/test_models/ -v

    -v  = verbose (shows each test name and PASSED/FAILED)

Pytest automatically discovers any file named test_*.py
and runs any function named test_*().
"""

import pytest
from pydantic import ValidationError

from models.bids_and_tendors import (
    BidsAndTenders,
    BidsSubmission,
    PlanTakers,
    PurchasingRepresentative,
)


# ---------------------------------------------------------------------------
# 1. REQUIRED FIELDS — make sure the model enforces them
# ---------------------------------------------------------------------------


class TestRequiredFields:
    """Group of tests that verify required fields are enforced."""

    def test_minimal_valid_bid(self):
        """The model should accept all 4 required fields."""
        bid = BidsAndTenders(
            bid_name="Test Bid",
            bid_status="Open",
            bid_closing_date="Fri Mar 20, 2026 3:00 PM (EDT)",
            bid_url="https://example.com/bid/001",
        )
        assert bid.bid_name == "Test Bid"
        assert bid.bid_status == "Open"

    def test_missing_bid_name_raises(self):
        """Omitting bid_name should raise a ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            BidsAndTenders(
                bid_status="Open",
                bid_closing_date="Fri Mar 20, 2026",
                bid_url="https://example.com",
            )
        # Check that the error mentions the missing field
        assert "bid_name" in str(exc_info.value)

    def test_missing_bid_url_raises(self):
        """Omitting bid_url should raise a ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            BidsAndTenders(
                bid_name="Test",
                bid_status="Open",
                bid_closing_date="Fri Mar 20, 2026",
            )
        assert "bid_url" in str(exc_info.value)

    def test_missing_multiple_fields_raises(self):
        """Omitting all required fields except one should list all missing."""
        with pytest.raises(ValidationError) as exc_info:
            BidsAndTenders(bid_name="Only name provided")
        errors = exc_info.value.errors()
        missing_fields = {e["loc"][0] for e in errors}
        assert missing_fields == {"bid_status", "bid_closing_date", "bid_url"}


# ---------------------------------------------------------------------------
# 2. OPTIONAL FIELDS — make sure they default to None
# ---------------------------------------------------------------------------


class TestOptionalFields:
    """Verify optional fields default to None and accept values."""

    def test_optional_fields_default_to_none(self):
        """All optional fields should be None when not provided."""
        bid = BidsAndTenders(
            bid_name="Test",
            bid_status="Open",
            bid_closing_date="Fri Mar 20, 2026",
            bid_url="https://example.com",
        )
        assert bid.days_left is None
        assert bid.bid_classification is None
        assert bid.bid_type is None
        assert bid.categories is None
        assert bid.purchasing_representive is None
        assert bid.bids_submitted is None
        assert bid.plan_takers is None

    def test_categories_accepts_list_of_strings(self):
        """categories should accept a list of strings."""
        bid = BidsAndTenders(
            bid_name="Test",
            bid_status="Open",
            bid_closing_date="Fri Mar 20, 2026",
            bid_url="https://example.com",
            categories=["Construction", "IT Services"],
        )
        assert bid.categories == ["Construction", "IT Services"]
        assert len(bid.categories) == 2


# ---------------------------------------------------------------------------
# 3. NESTED MODELS — test the sub-models independently and within the parent
# ---------------------------------------------------------------------------


class TestNestedModels:
    """Test PurchasingRepresentative, BidsSubmission, and PlanTakers."""

    def test_purchasing_representative(self):
        rep = PurchasingRepresentative(
            name="Jane Smith",
            contact_email="jane@markham.ca",
        )
        assert rep.name == "Jane Smith"
        assert rep.contact_email == "jane@markham.ca"

    def test_bids_submission_with_result(self):
        sub = BidsSubmission(
            company_name="ABC Corp",
            contact_addres="123 Main St",
            result="Awarded",
        )
        assert sub.result == "Awarded"

    def test_bids_submission_result_defaults_to_none(self):
        sub = BidsSubmission(
            company_name="ABC Corp",
            contact_addres="123 Main St",
        )
        assert sub.result is None

    def test_plan_takers(self):
        pt = PlanTakers(
            company_name="DEF Ltd",
            contact_addres="456 Oak Ave",
        )
        assert pt.company_name == "DEF Ltd"

    def test_nested_models_in_parent(self):
        """Nested models should serialize correctly inside BidsAndTenders."""
        bid = BidsAndTenders(
            bid_name="Test",
            bid_status="Open",
            bid_closing_date="Fri Mar 20, 2026",
            bid_url="https://example.com",
            purchasing_representive=PurchasingRepresentative(name="Jane", contact_email="jane@markham.ca"),
            bids_submitted=[
                BidsSubmission(company_name="A", contact_addres="addr1", result="Won"),
                BidsSubmission(company_name="B", contact_addres="addr2"),
            ],
            plan_takers=[
                PlanTakers(company_name="C", contact_addres="addr3"),
            ],
        )
        assert bid.purchasing_representive.name == "Jane"
        assert len(bid.bids_submitted) == 2
        assert bid.bids_submitted[0].result == "Won"
        assert bid.bids_submitted[1].result is None
        assert len(bid.plan_takers) == 1


# ---------------------------------------------------------------------------
# 4. SERIALIZATION — make sure the model converts to dict/JSON cleanly
# ---------------------------------------------------------------------------


class TestSerialization:
    """Test model_dump() and model_dump_json() output."""

    def test_model_dump_returns_dict(self):
        bid = BidsAndTenders(
            bid_name="Test",
            bid_status="Open",
            bid_closing_date="Fri Mar 20, 2026",
            bid_url="https://example.com",
        )
        data = bid.model_dump()
        assert isinstance(data, dict)
        assert data["bid_name"] == "Test"

    def test_model_dump_json_returns_string(self):
        bid = BidsAndTenders(
            bid_name="Test",
            bid_status="Open",
            bid_closing_date="Fri Mar 20, 2026",
            bid_url="https://example.com",
        )
        json_str = bid.model_dump_json()
        assert isinstance(json_str, str)
        assert '"bid_name":"Test"' in json_str

    def test_model_dump_exclude_none(self):
        """model_dump(exclude_none=True) should omit None fields —
        useful when inserting into Supabase so you don't send nulls."""
        bid = BidsAndTenders(
            bid_name="Test",
            bid_status="Open",
            bid_closing_date="Fri Mar 20, 2026",
            bid_url="https://example.com",
        )
        data = bid.model_dump(exclude_none=True)
        assert "days_left" not in data
        assert "categories" not in data
        # Only the 4 required fields should remain
        assert len(data) == 4
