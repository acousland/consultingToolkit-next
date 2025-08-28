"""AI-Powered Pain Point Extraction & Analysis Service.

Uses advanced language models to intelligently extract, interpret, and categorize pain points
from raw text. Focuses on identifying genuine business/technology problems rather than 
simple text cleanup.

Design goals:
- Intelligent pain point extraction using LLMs (GPT-4o-mini/GPT-5-mini)
- Business vs Technology categorization
- Deep interpretation of underlying problems
- Smart deduplication based on semantic meaning
- Clear, actionable pain point statements
"""
from __future__ import annotations

import os
import asyncio
import json
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional, Union
import io
import pandas as pd

from .llm import get_pain_point_llm
from langchain_core.messages import HumanMessage

# Use GPT-5-mini by default for superior analysis capabilities
PAIN_POINT_MODEL = os.getenv("PAIN_POINT_MODEL", "gpt-5-mini")

@dataclass
class ExtractedPainPoint:
    id: str
    original_text: str
    extracted_pain_point: str
    category: str  # "business" or "technology"
    severity: str  # "low", "medium", "high", "critical"
    stakeholders: List[str]
    root_cause: str
    impact_description: str
    confidence: float  # 0.0 to 1.0
    
@dataclass
class PainPointCluster:
    cluster_id: str
    representative_pain_point: str
    member_ids: List[str]
    category: str
    severity: str
    combined_impact: str
    recommended_action: str

async def extract_pain_points_from_text(raw_text: str, context: str = "") -> List[ExtractedPainPoint]:
    """Extract and analyze pain points from raw text using AI."""
    pain_point_llm = get_pain_point_llm()
    
    if not pain_point_llm:
        # Fallback when LLM is not available
        lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        return [
            ExtractedPainPoint(
                id=f"PP{i+1}",
                original_text=line,
                extracted_pain_point=line,
                category="unknown",
                severity="medium",
                stakeholders=["users"],
                root_cause="Unknown - LLM not available",
                impact_description="Unknown impact",
                confidence=0.5
            ) for i, line in enumerate(lines)
        ]
    
    # Enhanced prompt optimized for individual pain point extraction
    prompt = f"""You are an expert business analyst powered by GPT-5-mini. Your task is to extract individual, discrete pain points from the provided text - each pain point should represent ONE specific issue.

CONTEXT: {context}

CRITICAL INSTRUCTIONS:
1. Extract INDIVIDUAL pain points - one problem per pain point, do not combine multiple issues
2. Each pain point should be a single, specific issue that someone experiences
3. If the text mentions multiple problems, create separate pain point entries for each one
4. Keep each extracted pain point focused and specific - avoid rolling up or consolidating
5. Distinguish between business pain points (process, strategy, people issues) and technology pain points (system failures, poor UX, technical limitations)
6. Extract the underlying problem, not just symptoms, but keep it to ONE issue per entry
7. Assess severity for each individual issue

TEXT TO ANALYZE:
{raw_text}

Return your analysis as a JSON array where EACH pain point represents ONE specific issue:
{{
  "original_text": "exact text from source that relates to this specific pain point",
  "extracted_pain_point": "clear, concise statement of ONE specific problem",
  "category": "business" or "technology",
  "severity": "low" | "medium" | "high" | "critical",
  "stakeholders": ["list", "of", "affected", "groups"],
  "root_cause": "likely underlying cause of this ONE specific problem",
  "impact_description": "how this specific problem affects the organization",
  "confidence": 0.0-1.0 confidence in this analysis
}}

EXAMPLES (showing individual extraction):

Input: "The login system crashes every morning during peak hours"
Extract ONE pain point: {{
  "original_text": "The login system crashes every morning during peak hours",
  "extracted_pain_point": "Authentication system fails during morning peak traffic",
  "category": "technology",
  "severity": "critical",
  "stakeholders": ["users", "customers", "support team"],
  "root_cause": "Authentication service cannot handle concurrent morning traffic load",
  "impact_description": "Users cannot access the system during peak business hours",
  "confidence": 0.9
}}

Input: "Reports take forever to load and the customer service interface is confusing"
Extract TWO separate pain points:
1. {{
  "original_text": "Reports take forever to load",
  "extracted_pain_point": "Report generation has poor performance",
  "category": "technology",
  "severity": "high",
  "stakeholders": ["managers", "analysts"],
  "root_cause": "Inefficient database queries or insufficient server resources",
  "impact_description": "Delayed decision-making due to slow business intelligence",
  "confidence": 0.85
}}
2. {{
  "original_text": "customer service interface is confusing",
  "extracted_pain_point": "Customer service interface has poor usability",
  "category": "technology", 
  "severity": "medium",
  "stakeholders": ["customer service team"],
  "root_cause": "Poor user experience design for support workflows",
  "impact_description": "Slower customer support response times and agent frustration",
  "confidence": 0.8
}}

REMEMBER: Extract individual, discrete pain points. Do not consolidate or roll up multiple issues into one entry."""

    try:
        # Use async execution for better performance
        loop = asyncio.get_event_loop()
        message = await loop.run_in_executor(
            None, 
            lambda: pain_point_llm.invoke([HumanMessage(content=prompt)])
        )
        
        response_text = message.content.strip()
        
        # Extract JSON from response (handle potential markdown formatting)
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        
        try:
            pain_points_data = json.loads(response_text)
        except json.JSONDecodeError:
            # Try to extract just the array part
            start = response_text.find('[')
            end = response_text.rfind(']') + 1
            if start >= 0 and end > start:
                pain_points_data = json.loads(response_text[start:end])
            else:
                raise
        
        extracted_points = []
        for i, data in enumerate(pain_points_data):
            extracted_points.append(ExtractedPainPoint(
                id=f"PP{i+1}",
                original_text=data.get("original_text", ""),
                extracted_pain_point=data.get("extracted_pain_point", ""),
                category=data.get("category", "unknown"),
                severity=data.get("severity", "medium"),
                stakeholders=data.get("stakeholders", []),
                root_cause=data.get("root_cause", ""),
                impact_description=data.get("impact_description", ""),
                confidence=float(data.get("confidence", 0.5))
            ))
        
        return extracted_points
        
    except Exception as e:
        # Fallback on error
        print(f"Error in pain point extraction: {e}")
        lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        return [
            ExtractedPainPoint(
                id=f"PP{i+1}",
                original_text=line,
                extracted_pain_point=line,
                category="unknown",
                severity="medium",
                stakeholders=["users"],
                root_cause=f"Analysis failed: {str(e)}",
                impact_description="Unknown impact",
                confidence=0.3
            ) for i, line in enumerate(lines)
        ]


async def cluster_pain_points(pain_points: List[ExtractedPainPoint], context: str = "") -> List[PainPointCluster]:
    """Group similar pain points using AI analysis."""
    pain_point_llm = get_pain_point_llm()
    
    if not pain_point_llm or len(pain_points) <= 1:
        # No clustering needed or possible
        return [
            PainPointCluster(
                cluster_id="C1",
                representative_pain_point=pp.extracted_pain_point,
                member_ids=[pp.id],
                category=pp.category,
                severity=pp.severity,
                combined_impact=pp.impact_description,
                recommended_action="Address this pain point"
            ) for pp in pain_points
        ]
    
    # Prepare pain points for clustering analysis
    pain_points_text = "\n".join([
        f"ID: {pp.id} | {pp.extracted_pain_point} | Category: {pp.category} | Severity: {pp.severity}"
        for pp in pain_points
    ])
    
    prompt = f"""You are analyzing individual pain points to identify only the most obvious clusters. Your goal is to preserve individual pain points and only group them when they are clearly about the SAME specific system or process.

CONTEXT: {context}

PAIN POINTS TO CLUSTER:
{pain_points_text}

CONSERVATIVE CLUSTERING INSTRUCTIONS:
1. Only group pain points if they are about the EXACT SAME system, feature, or process
2. Keep distinct issues separate even if they are related - err on the side of keeping them apart
3. A cluster should represent multiple mentions of the same underlying issue, not different issues in the same domain
4. Create clusters only when pain points are near-duplicates or clearly about the same specific problem
5. When in doubt, keep pain points in separate clusters
6. Avoid grouping based on category alone (e.g., don't group all "technology" issues together)

Return JSON array of clusters, being conservative about grouping:
{{
  "cluster_id": "C1",
  "representative_pain_point": "clear statement representing the specific issue (not a broad category)",
  "member_ids": ["PP1", "PP2"],
  "category": "business" or "technology",
  "severity": "highest severity in cluster",
  "combined_impact": "impact of this specific issue",
  "recommended_action": "specific action for this particular problem"
}}

EXAMPLE OF WHAT TO CLUSTER:
- "Login system crashes" + "Authentication fails during peak hours" = CLUSTER (same system)
- "Reports are slow" + "Dashboard takes forever to load" = DON'T CLUSTER (different systems)

EXAMPLE OF WHAT NOT TO CLUSTER:
- "Email server is down" + "CRM system is slow" = DON'T CLUSTER (different systems)
- "Poor documentation" + "Lack of training" = DON'T CLUSTER (different business issues)

Be conservative - preserve individual pain points as separate clusters when there's any doubt."""

    try:
        loop = asyncio.get_event_loop()
        message = await loop.run_in_executor(
            None,
            lambda: pain_point_llm.invoke([HumanMessage(content=prompt)])
        )
        
        response_text = message.content.strip()
        
        # Extract JSON from response
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        
        try:
            clusters_data = json.loads(response_text)
        except json.JSONDecodeError:
            start = response_text.find('[')
            end = response_text.rfind(']') + 1
            if start >= 0 and end > start:
                clusters_data = json.loads(response_text[start:end])
            else:
                raise
        
        clusters = []
        for data in clusters_data:
            clusters.append(PainPointCluster(
                cluster_id=data.get("cluster_id", f"C{len(clusters)+1}"),
                representative_pain_point=data.get("representative_pain_point", ""),
                member_ids=data.get("member_ids", []),
                category=data.get("category", "unknown"),
                severity=data.get("severity", "medium"),
                combined_impact=data.get("combined_impact", ""),
                recommended_action=data.get("recommended_action", "")
            ))
        
        return clusters
        
    except Exception as e:
        print(f"Error in clustering: {e}")
        # Fallback: each pain point in its own cluster
        return [
            PainPointCluster(
                cluster_id=f"C{i+1}",
                representative_pain_point=pp.extracted_pain_point,
                member_ids=[pp.id],
                category=pp.category,
                severity=pp.severity,
                combined_impact=pp.impact_description,
                recommended_action="Address this pain point"
            ) for i, pp in enumerate(pain_points)
        ]


@dataclass
class ProposalRow:
    """Legacy structure for compatibility with existing frontend."""
    id: str
    original: str
    group_id: str
    proposed: str
    action: str
    rationale: str
    merged_ids: List[str]
    
    # Enhanced fields for AI analysis
    category: str = ""
    severity: str = ""
    stakeholders: List[str] = None
    root_cause: str = ""
    impact: str = ""
    confidence: float = 0.0


async def build_proposals(raw_points: List[str], options: Dict[str, Any]) -> Dict[str, Any]:
    """Main function to build pain point proposals using AI analysis."""
    context = options.get("context", "")
    
    # If raw_points is a list of strings, treat as separate lines
    if raw_points and isinstance(raw_points[0], str):
        raw_text = "\n".join(raw_points)
    else:
        raw_text = str(raw_points)
    
    try:
        # Extract pain points using AI (now properly async)
        extracted_points = await extract_pain_points_from_text(raw_text, context)
        
        # Cluster similar pain points (now properly async)
        clusters = await cluster_pain_points(extracted_points, context)
        
        # Convert to legacy format for frontend compatibility
        proposal = []
        for cluster in clusters:
            primary_id = cluster.member_ids[0] if cluster.member_ids else f"PP{len(proposal)+1}"
            
            # Find the primary pain point
            primary_point = next(
                (pp for pp in extracted_points if pp.id == primary_id), 
                extracted_points[0] if extracted_points else None
            )
            
            if not primary_point:
                continue
                
            # Create primary row
            proposal.append(ProposalRow(
                id=primary_id,
                original=primary_point.original_text,
                group_id=cluster.cluster_id,
                proposed=cluster.representative_pain_point,
                action="AI-Enhanced" if cluster.representative_pain_point != primary_point.original_text else "Keep",
                rationale=f"Category: {cluster.category}, Severity: {cluster.severity}. {cluster.recommended_action}",
                merged_ids=cluster.member_ids[1:] if len(cluster.member_ids) > 1 else [],
                category=cluster.category,
                severity=cluster.severity,
                stakeholders=primary_point.stakeholders or [],
                root_cause=primary_point.root_cause,
                impact=cluster.combined_impact,
                confidence=primary_point.confidence
            ))
            
            # Create rows for merged items
            for merged_id in cluster.member_ids[1:]:
                merged_point = next((pp for pp in extracted_points if pp.id == merged_id), None)
                if merged_point:
                    proposal.append(ProposalRow(
                        id=merged_id,
                        original=merged_point.original_text,
                        group_id=cluster.cluster_id,
                        proposed="",
                        action=f"Merge->{primary_id}",
                        rationale=f"Merged into {primary_id}: Similar issue",
                        merged_ids=[],
                        category=merged_point.category,
                        severity=merged_point.severity,
                        stakeholders=merged_point.stakeholders or [],
                        root_cause=merged_point.root_cause,
                        impact=merged_point.impact_description,
                        confidence=merged_point.confidence
                    ))
        
        # Calculate summary statistics
        business_count = len([p for p in extracted_points if p.category == "business"])
        technology_count = len([p for p in extracted_points if p.category == "technology"])
        high_severity_count = len([p for p in extracted_points if p.severity in ["high", "critical"]])
        
        summary = {
            "total_raw": len(raw_points),
            "ai_extracted": len(extracted_points),
            "clustered_groups": len(clusters),
            "business_pain_points": business_count,
            "technology_pain_points": technology_count,
            "high_severity_issues": high_severity_count,
            "ai_model_used": PAIN_POINT_MODEL,
            "analysis_quality": "AI-Enhanced" if get_pain_point_llm() else "Basic Fallback"
        }
        
        return {
            "proposal": [asdict(r) for r in proposal],
            "summary": summary
        }
        
    except Exception as e:
        # Fallback on any error
        print(f"Error in build_proposals: {e}")
        return {
            "proposal": [],
            "summary": {
                "total_raw": len(raw_points),
                "ai_extracted": 0,
                "clustered_groups": 0,
                "business_pain_points": 0,
                "technology_pain_points": 0,
                "high_severity_issues": 0,
                "ai_model_used": PAIN_POINT_MODEL,
                "analysis_quality": f"Error: {str(e)}"
            }
        }


def apply_actions(proposal_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Apply the proposed actions to generate final pain point list."""
    final = []
    kept_ids = set()
    
    for r in proposal_rows:
        action = r.get("action", "Keep")
        pain_point_id = r.get("id")
        
        # Skip merged or dropped items
        if action.startswith("Merge->") or action == "Drop":
            continue
            
        # Get the final text (proposed or original)
        text = r.get("proposed") or r.get("original")
        if not text or pain_point_id in kept_ids:
            continue
            
        kept_ids.add(pain_point_id)
        
        # Include enhanced metadata
        final.append({
            "id": pain_point_id,
            "text": text,
            "category": r.get("category", "unknown"),
            "severity": r.get("severity", "medium"),
            "stakeholders": r.get("stakeholders", []),
            "root_cause": r.get("root_cause", ""),
            "impact": r.get("impact", ""),
            "confidence": r.get("confidence", 0.0)
        })
    
    return {
        "clean_pain_points": final,
        "count": len(final)
    }


def export_report(proposal_rows: List[Dict[str, Any]], summary: Dict[str, Any]) -> bytes:
    """Export analysis to Excel with enhanced AI insights."""
    # Prepare DataFrames with enhanced columns
    df_proposals = pd.DataFrame(proposal_rows)
    
    # Add analysis insights if available
    if "category" in df_proposals.columns:
        df_insights = df_proposals.groupby(["category", "severity"]).size().reset_index(name="count")
    else:
        df_insights = pd.DataFrame({"analysis": ["Basic analysis - no AI categorization available"]})
    
    df_final = pd.DataFrame(apply_actions(proposal_rows)["clean_pain_points"])
    df_summary = pd.DataFrame([summary])
    
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="xlsxwriter") as writer:
        df_proposals.to_excel(writer, index=False, sheet_name="AI Analysis")
        df_final.to_excel(writer, index=False, sheet_name="Final Pain Points")
        df_insights.to_excel(writer, index=False, sheet_name="Insights")
        df_summary.to_excel(writer, index=False, sheet_name="Summary")
    
    return bio.getvalue()
