from typing import List, Optional
from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field


class SignalCategory(str, Enum):
    BUDGET = "budget"
    TIMING = "timing"
    INCUMBENT_COMPETITOR = "incumbent_competitor"
    SCOPE = "scope"
    DECISION_MAKER = "decision_maker"
    LIFECYCLE = "lifecycle"
    ENGAGEMENT = "engagement"
    RISK = "risk"
    POLICY_REGULATORY = "policy_regulatory"
    TECHNOLOGY = "technology"
    INFRASTRUCTURE = "infrastructure"
    WORKFORCE = "workforce"
    ENVIRONMENTAL = "environmental"
    CONTRACT_STRUCTURE = "contract_structure"
    POLITICAL = "political"
    GEOGRAPHIC = "geographic"


class SignalType(str, Enum):
    # ── Budget signals ──
    BUDGET_ALLOCATION = "budget_allocation"
    BUDGET_INCREASE = "budget_increase"
    BUDGET_DECREASE = "budget_decrease"
    CAPITAL_PLAN_ENTRY = "capital_plan_entry"
    GRANT_RECEIVED = "grant_received"
    GRANT_APPLICATION = "grant_application"
    BOND_APPROVED = "bond_approved"
    BUDGET_AMENDMENT = "budget_amendment"
    SUPPLEMENTAL_APPROPRIATION = "supplemental_appropriation"
    RESERVE_FUND_DRAW = "reserve_fund_draw"
    DEVELOPMENT_CHARGE_REVENUE = "development_charge_revenue"
    FISCAL_YEAR_END_SPENDING = "fiscal_year_end_spending"
    COST_OVERRUN = "cost_overrun"
    FUNDING_SOURCE_CHANGE = "funding_source_change"

    # ── Timing signals ──
    CONTRACT_EXPIRING = "contract_expiring"
    CONTRACT_RENEWAL = "contract_renewal"
    CONTRACT_EXTENSION = "contract_extension"
    CONTRACT_EXECUTION = "contract_execution"
    FEASIBILITY_STUDY = "feasibility_study"
    RFI_ISSUED = "rfi_issued"
    RFQ_ISSUED = "rfq_issued"
    PROCUREMENT_FORECAST = "procurement_forecast"
    OPTION_NOT_EXERCISED = "option_not_exercised"
    OPTION_EXERCISED = "option_exercised"
    RFP_IMMINENT = "rfp_imminent"
    RFP_PUBLISHED = "rfp_published"
    DRAFT_RFP_RELEASED = "draft_rfp_released"
    SOLICITATION_DELAYED = "solicitation_delayed"
    SOLICITATION_CANCELLED = "solicitation_cancelled"
    ACCELERATED_TIMELINE = "accelerated_timeline"
    EMERGENCY_PROCUREMENT = "emergency_procurement"
    SEASONAL_PROCUREMENT = "seasonal_procurement"

    # ── Incumbent / Competitor signals ──
    CURRENT_VENDOR = "current_vendor"
    VENDOR_COMPLAINT = "vendor_complaint"
    VENDOR_PERFORMANCE_REVIEW = "vendor_performance_review"
    VENDOR_PRAISED = "vendor_praised"
    SOLE_SOURCE = "sole_source"
    SOLE_SOURCE_JUSTIFICATION = "sole_source_justification"
    CONTRACT_MODIFICATION = "contract_modification"
    CHANGE_ORDER = "change_order"
    PROTEST_FILED = "protest_filed"
    CONTRACT_TERMINATED = "contract_terminated"
    VENDOR_DEFAULT = "vendor_default"
    SUBCONTRACTOR_IDENTIFIED = "subcontractor_identified"
    TEAMING_ARRANGEMENT = "teaming_arrangement"
    INCUMBENT_ADVANTAGE = "incumbent_advantage"
    NEW_MARKET_ENTRANT = "new_market_entrant"
    PURCHASE_ORDER_ISSUED = "purchase_order_issued"

    # ── Scope signals ──
    PROJECT_DESCRIPTION = "project_description"
    TECH_REQUIREMENT = "tech_requirement"
    PAIN_POINT = "pain_point"
    SYSTEM_REPLACEMENT = "system_replacement"
    SYSTEM_UPGRADE = "system_upgrade"
    COMPLIANCE_REQUIREMENT = "compliance_requirement"
    SCOPE_EXPANSION = "scope_expansion"
    SCOPE_REDUCTION = "scope_reduction"
    NEW_SERVICE_NEED = "new_service_need"
    MAINTENANCE_BACKLOG = "maintenance_backlog"
    CAPACITY_CONSTRAINT = "capacity_constraint"
    INTEGRATION_REQUIREMENT = "integration_requirement"
    ACCESSIBILITY_REQUIREMENT = "accessibility_requirement"
    SECURITY_REQUIREMENT = "security_requirement"
    DATA_MIGRATION = "data_migration"
    MULTI_PHASE_PROJECT = "multi_phase_project"
    EVALUATION_CRITERIA = "evaluation_criteria"
    MANDATORY_QUALIFICATION = "mandatory_qualification"
    DELIVERY_DEADLINE = "delivery_deadline"

    # ── Decision-maker signals ──
    KEY_PERSONNEL = "key_personnel"
    LEADERSHIP_CHANGE = "leadership_change"
    COMMITTEE_ASSIGNMENT = "committee_assignment"
    STAFF_REPORT_AUTHOR = "staff_report_author"
    CONSULTANT_ADVISOR = "consultant_advisor"
    COUNCIL_CHAMPION = "council_champion"
    DEPARTMENT_REORGANIZATION = "department_reorganization"
    NEW_PROCUREMENT_OFFICER = "new_procurement_officer"
    EXTERNAL_REVIEWER = "external_reviewer"
    VOTING_PATTERN = "voting_pattern"

    # ── Lifecycle signals ──
    NEEDS_DISCUSSION = "needs_discussion"
    DESIGN_PHASE = "design_phase"
    COUNCIL_APPROVAL_TO_SOLICIT = "council_approval_to_solicit"
    AWARD_RECOMMENDATION = "award_recommendation"
    MASTER_PLAN_REFERENCE = "master_plan_reference"
    STRATEGIC_PLAN_ALIGNMENT = "strategic_plan_alignment"
    ENVIRONMENTAL_ASSESSMENT = "environmental_assessment"
    PERMITTING_STAGE = "permitting_stage"
    CONSTRUCTION_COMMENCEMENT = "construction_commencement"
    PROJECT_COMPLETION = "project_completion"
    WARRANTY_EXPIRATION = "warranty_expiration"
    POST_IMPLEMENTATION_REVIEW = "post_implementation_review"
    FOLLOW_ON_OPPORTUNITY = "follow_on_opportunity"

    # ── Engagement signals ──
    PRE_BID_CONFERENCE = "pre_bid_conference"
    PUBLIC_COMMENT_PERIOD = "public_comment_period"
    PILOT_PROGRAM = "pilot_program"
    INTERAGENCY_COLLABORATION = "interagency_collaboration"
    INDUSTRY_DAY = "industry_day"
    VENDOR_DEMONSTRATION = "vendor_demonstration"
    SITE_VISIT_SCHEDULED = "site_visit_scheduled"
    STAKEHOLDER_CONSULTATION = "stakeholder_consultation"
    PUBLIC_HEARING = "public_hearing"
    COMMUNITY_SURVEY = "community_survey"
    ADDENDUM_ISSUED = "addendum_issued"

    # ── Risk signals ──
    PROJECT_DELAY = "project_delay"
    COST_ESCALATION = "cost_escalation"
    LITIGATION_RISK = "litigation_risk"
    SUPPLY_CHAIN_ISSUE = "supply_chain_issue"
    SAFETY_INCIDENT = "safety_incident"
    INSURANCE_CLAIM = "insurance_claim"
    AUDIT_FINDING = "audit_finding"
    COMPLIANCE_VIOLATION = "compliance_violation"
    POLITICAL_OPPOSITION = "political_opposition"
    COMMUNITY_OPPOSITION = "community_opposition"
    LABOUR_DISPUTE = "labour_dispute"
    FORCE_MAJEURE = "force_majeure"
    FRAUD_ALLEGATION = "fraud_allegation"

    # ── Policy / Regulatory signals ──
    BYLAW_CHANGE = "bylaw_change"
    POLICY_UPDATE = "policy_update"
    PROCUREMENT_POLICY_CHANGE = "procurement_policy_change"
    THRESHOLD_CHANGE = "threshold_change"
    LOCAL_PREFERENCE_POLICY = "local_preference_policy"
    DBE_MBE_WBE_REQUIREMENT = "dbe_mbe_wbe_requirement"
    COOPERATIVE_PURCHASING = "cooperative_purchasing"
    STANDING_OFFER_AGREEMENT = "standing_offer_agreement"
    NEW_REGULATION = "new_regulation"
    FEDERAL_PROVINCIAL_MANDATE = "federal_provincial_mandate"
    TRADE_AGREEMENT_IMPACT = "trade_agreement_impact"
    ACCESSIBILITY_LEGISLATION = "accessibility_legislation"

    # ── Technology signals ──
    DIGITAL_TRANSFORMATION = "digital_transformation"
    CLOUD_MIGRATION = "cloud_migration"
    CYBERSECURITY_INITIATIVE = "cybersecurity_initiative"
    SOFTWARE_LICENSE_EXPIRY = "software_license_expiry"
    ERP_IMPLEMENTATION = "erp_implementation"
    GIS_MAPPING_PROJECT = "gis_mapping_project"
    SMART_CITY_INITIATIVE = "smart_city_initiative"
    IOT_DEPLOYMENT = "iot_deployment"
    AI_ML_INITIATIVE = "ai_ml_initiative"
    OPEN_DATA_INITIATIVE = "open_data_initiative"
    NETWORK_INFRASTRUCTURE = "network_infrastructure"
    LEGACY_SYSTEM_END_OF_LIFE = "legacy_system_end_of_life"

    # ── Infrastructure signals ──
    AGING_INFRASTRUCTURE = "aging_infrastructure"
    BRIDGE_ROAD_REPAIR = "bridge_road_repair"
    WATER_WASTEWATER = "water_wastewater"
    FLEET_REPLACEMENT = "fleet_replacement"
    FACILITY_CONSTRUCTION = "facility_construction"
    FACILITY_RENOVATION = "facility_renovation"
    ASSET_CONDITION_ASSESSMENT = "asset_condition_assessment"
    UTILITY_RELOCATION = "utility_relocation"
    TRANSIT_EXPANSION = "transit_expansion"
    PARK_RECREATION = "park_recreation"
    HOUSING_DEVELOPMENT = "housing_development"
    DEMOLITION = "demolition"

    # ── Workforce signals ──
    STAFFING_SHORTAGE = "staffing_shortage"
    CONSULTING_NEED = "consulting_need"
    OUTSOURCING_DISCUSSION = "outsourcing_discussion"
    INSOURCING_DISCUSSION = "insourcing_discussion"
    TRAINING_REQUIREMENT = "training_requirement"
    TEMPORARY_STAFFING = "temporary_staffing"
    COLLECTIVE_AGREEMENT_EXPIRY = "collective_agreement_expiry"
    NEW_POSITION_CREATED = "new_position_created"

    # ── Environmental / Sustainability signals ──
    CLIMATE_ACTION_PLAN = "climate_action_plan"
    GREEN_PROCUREMENT = "green_procurement"
    EMISSIONS_REDUCTION = "emissions_reduction"
    EV_FLEET_TRANSITION = "ev_fleet_transition"
    RENEWABLE_ENERGY = "renewable_energy"
    BUILDING_RETROFIT = "building_retrofit"
    WASTE_MANAGEMENT = "waste_management"
    STORMWATER_MANAGEMENT = "stormwater_management"
    CONTAMINATION_REMEDIATION = "contamination_remediation"
    TREE_CANOPY_INITIATIVE = "tree_canopy_initiative"

    # ── Contract structure signals ──
    MULTI_YEAR_CONTRACT = "multi_year_contract"
    BLANKET_PURCHASE_ORDER = "blanket_purchase_order"
    JOINT_VENTURE_REQUIRED = "joint_venture_required"
    BONDING_REQUIREMENT = "bonding_requirement"
    INSURANCE_REQUIREMENT = "insurance_requirement"
    PREQUALIFICATION_REQUIRED = "prequalification_required"
    ROSTER_PANEL_ESTABLISHMENT = "roster_panel_establishment"
    FRAMEWORK_AGREEMENT = "framework_agreement"
    PERFORMANCE_BASED_CONTRACT = "performance_based_contract"
    PUBLIC_PRIVATE_PARTNERSHIP = "public_private_partnership"

    # ── Political signals ──
    ELECTION_CYCLE = "election_cycle"
    NEW_COUNCIL_PRIORITIES = "new_council_priorities"
    COUNCIL_MOTION = "council_motion"
    DELEGATION_PRESENTATION = "delegation_presentation"
    PETITION_RECEIVED = "petition_received"
    MEDIA_COVERAGE = "media_coverage"
    POLITICAL_PROMISE = "political_promise"
    INTERGOVERNMENTAL_AGREEMENT = "intergovernmental_agreement"

    # ── Geographic signals ──
    WARD_SPECIFIC_PROJECT = "ward_specific_project"
    GROWTH_AREA_DESIGNATION = "growth_area_designation"
    ZONING_CHANGE = "zoning_change"
    SECONDARY_PLAN = "secondary_plan"
    BROWNFIELD_REDEVELOPMENT = "brownfield_redevelopment"
    ANNEXATION_AMALGAMATION = "annexation_amalgamation"
    REGIONAL_COORDINATION = "regional_coordination"


class SourceType(str, Enum):
    BID = "bid"
    MEETING_MINUTES = "meeting_minutes"
    AGENDA = "agenda"
    BUDGET = "budget"
    STAFF_REPORT = "staff_report"
    CAPITAL_PLAN = "capital_plan"
    STRATEGIC_PLAN = "strategic_plan"
    BYLAW = "bylaw"
    AUDIT_REPORT = "audit_report"
    PUBLIC_NOTICE = "public_notice"
    COUNCIL_RESOLUTION = "council_resolution"
    COMMITTEE_REPORT = "committee_report"
    PURCHASING_REPORT = "purchasing_report"


class ProcurementStage(str, Enum):
    NEEDS_IDENTIFIED = "needs_identified"
    STUDY_AUTHORIZED = "study_authorized"
    BUDGET_ALLOCATED = "budget_allocated"
    MARKET_RESEARCH = "market_research"
    SPECIFICATION_DEVELOPMENT = "specification_development"
    RFP_IMMINENT = "rfp_imminent"
    RFP_PUBLISHED = "rfp_published"
    EVALUATION_IN_PROGRESS = "evaluation_in_progress"
    SHORTLISTED = "shortlisted"
    NEGOTIATION = "negotiation"
    AWARDED = "awarded"
    CONTRACT_EXECUTION = "contract_execution"
    IN_PROGRESS = "in_progress"
    CLOSEOUT = "closeout"


class Entity(BaseModel):
    name: str
    entity_type: str  # "person", "organization", "dollar_amount", "date", "project"
    role: Optional[str] = None  # "procurement_officer", "vendor", "council_member", etc.


# ── Signal scoring ──
# Weights for how actionable each category is for pre-RFP intelligence

_CATEGORY_WEIGHTS: dict[str, float] = {
    # High-value: directly leads to contract opportunities
    "budget": 0.9,
    "timing": 1.0,
    "scope": 0.85,
    "contract_structure": 0.85,
    "lifecycle": 0.8,
    # Medium-value: context that shapes bid strategy
    "incumbent_competitor": 0.75,
    "decision_maker": 0.7,
    "technology": 0.7,
    "infrastructure": 0.7,
    "workforce": 0.65,
    "engagement": 0.6,
    # Lower-value: background intelligence
    "risk": 0.5,
    "policy_regulatory": 0.5,
    "environmental": 0.45,
    "political": 0.35,
    "geographic": 0.3,
}

# Procurement stages closer to RFP = higher score multiplier
_STAGE_MULTIPLIERS: dict[str, float] = {
    "rfp_imminent": 1.0,
    "specification_development": 0.95,
    "rfp_published": 0.9,
    "budget_allocated": 0.85,
    "market_research": 0.8,
    "study_authorized": 0.75,
    "evaluation_in_progress": 0.7,
    "shortlisted": 0.65,
    "needs_identified": 0.6,
    "negotiation": 0.5,
    "awarded": 0.3,
    "contract_execution": 0.25,
    "in_progress": 0.2,
    "closeout": 0.1,
}


def compute_signal_score(signal: "Signal") -> float:
    """
    Compute a 0-1 score for how actionable/valuable a signal is.

    Formula:
      score = category_weight × confidence × stage_multiplier × richness_bonus

    - category_weight:   How actionable is this signal category? (timing=1.0, political=0.35)
    - confidence:        How certain are we the signal is real? (0.0-1.0)
    - stage_multiplier:  How close to RFP? (rfp_imminent=1.0, closeout=0.1, none=0.5)
    - richness_bonus:    Does it have dollar amounts, bid numbers, entities? (+0-20%)
    """
    cat_weight = _CATEGORY_WEIGHTS.get(signal.signal_category.value, 0.5)

    if signal.procurement_stage:
        stage_mult = _STAGE_MULTIPLIERS.get(signal.procurement_stage.value, 0.5)
    else:
        stage_mult = 0.5  # Unknown stage = neutral

    # Richness bonus: signals with more data points are more useful
    bonus = 1.0
    if signal.estimated_value and signal.estimated_value > 0:
        bonus += 0.1  # Has a dollar amount
    if signal.related_bid_number:
        bonus += 0.05  # Has a bid/contract number
    if len(signal.entities) >= 2:
        bonus += 0.05  # Has multiple entities

    raw = cat_weight * signal.confidence * stage_mult * bonus
    return round(min(raw, 1.0), 3)


class Signal(BaseModel):
    source_type: SourceType
    source_url: str
    city: str
    year: Optional[int] = None
    pdf_document_url: Optional[str] = None  # Direct link to the PDF file where signal was found

    signal_type: SignalType
    signal_category: SignalCategory
    confidence: float = Field(ge=0.0, le=1.0)

    summary: str
    raw_excerpt: str

    entities: List[Entity] = Field(default_factory=list)
    procurement_stage: Optional[ProcurementStage] = None
    estimated_value: Optional[float] = None
    estimated_timeline: Optional[str] = None
    related_bid_number: Optional[str] = None

    score: float = Field(default=0.0, ge=0.0, le=1.0)

    extracted_at: datetime = Field(default_factory=datetime.utcnow)

    def model_post_init(self, __context) -> None:
        """Auto-compute score after initialization if not explicitly set."""
        if self.score == 0.0:
            self.score = compute_signal_score(self)


class DocumentExtractionStatus(str, Enum):
    PENDING = "pending"
    DOWNLOADING = "downloading"
    EXTRACTING_TEXT = "extracting_text"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"


class PDFDocument(BaseModel):
    source_url: str
    city: str
    year: Optional[int] = None
    source_type: SourceType
    local_path: Optional[str] = None
    page_count: Optional[int] = None
    extracted_text_length: Optional[int] = None
    status: DocumentExtractionStatus = DocumentExtractionStatus.PENDING
    error_message: Optional[str] = None
    signals_extracted: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
