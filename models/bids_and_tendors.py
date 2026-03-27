from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class BidsSubmission(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    company_name: str
    contact_address: str = Field(alias="contact_addres")
    result: Optional[str] = None


class PlanTakers(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    company_name: str
    contact_address: str = Field(alias="contact_addres")


class PurchasingRepresentative(BaseModel):
    name: str
    contact_email: str


class BidsAndTenders(BaseModel):
    # Metadata (set by crawler, not scraped)
    city: Optional[str] = None
    year: Optional[int] = None

    # Core fields (required)
    bid_name: str
    bid_status: str
    bid_closing_date: str
    bid_url: str

    # Fields from listing page
    days_left: Optional[str] = None
    bid_classification: Optional[str] = None

    # Detail page fields (all optional)
    bid_type: Optional[str] = None
    bid_number: Optional[str] = None
    published_date: Optional[str] = None
    question_deadline: Optional[str] = None
    bid_pricing: Optional[str] = None
    electronic_auctions: Optional[str] = None
    language_for_bid_submissions: Optional[str] = None
    submission_type: Optional[str] = None
    submission_address: Optional[str] = None
    public_opening: Optional[str] = None
    description: Optional[str] = None
    bid_document_access: Optional[str] = None
    categories: Optional[List[str]] = None

    # purchasing representative
    purchasing_representive: Optional[PurchasingRepresentative] = None

    # current status of bids
    bids_submitted: Optional[List[BidsSubmission]] = None
    plan_takers: Optional[List[PlanTakers]] = None
