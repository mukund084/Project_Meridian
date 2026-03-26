from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class Document(BaseModel):
    """
    Represents a collected document (Agenda, Minutes, etc.) from the Meetings scraper.
    """

    # Metadata (set by crawler, not scraped)
    city: str = ""
    year: int = 0

    meeting_title: str
    meeting_date: str
    document_type: str
    pdf_url: str
