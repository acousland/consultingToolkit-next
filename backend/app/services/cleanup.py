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

# Use GPT-4o-mini by default, but allow override to GPT-5-mini for this specific use case
PAIN_POINT_MODEL = os.getenv("PAIN_POINT_MODEL", "gpt-4o-mini")

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
    
    # Enhanced prompt for GPT-4o-mini/GPT-5-mini
    prompt = f"""You are an expert business analyst and technology consultant. Your task is to extract and analyze pain points from the provided text.

CONTEXT: {context}

INSTRUCTIONS:
1. Identify genuine pain points - problems that cause frustration, inefficiency, or prevent desired outcomes
2. Distinguish between business pain points (process, strategy, people issues) and technology pain points (system failures, poor UX, technical limitations)
3. Extract the underlying problem, not just symptoms
4. Assess severity based on potential business impact
5. Identify likely stakeholders affected
6. Determine root causes where possible

TEXT TO ANALYZE:
{raw_text}

Return your analysis as a JSON array where each pain point has this structure:
{{
  "original_text": "exact text from source",
  "extracted_pain_point": "clear, concise statement of the actual problem",
  "category": "business" or "technology",
  "severity": "low" | "medium" | "high" | "critical",
  "stakeholders": ["list", "of", "affected", "groups"],
  "root_cause": "likely underlying cause of this problem",
  "impact_description": "how this problem affects the organization",
  "confidence": 0.0-1.0 confidence in this analysis
}}

EXAMPLE:
If the text says "The system takes forever to load reports"
Extract: {{
  "original_text": "The system takes forever to load reports",
  "extracted_pain_point": "Report generation system has poor performance causing productivity delays",
  "category": "technology",
  "severity": "high",
  "stakeholders": ["managers", "analysts", "executives"],
  "root_cause": "Inefficient database queries or inadequate server resources",
  "impact_description": "Delayed decision-making, reduced productivity, user frustration",
  "confidence": 0.85
}}

Focus on extracting real problems, not just complaints. Be thorough but precise."""

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
    
    prompt = f"""You are analyzing pain points to identify clusters of related issues. Group pain points that address the same underlying problem or system.

CONTEXT: {context}

PAIN POINTS TO CLUSTER:
{pain_points_text}

INSTRUCTIONS:
1. Group pain points that relate to the same system, process, or underlying issue
2. Create a representative statement that captures the essence of each cluster
3. Determine the highest severity in each cluster
4. Suggest specific actions for each cluster
5. Focus on semantic similarity, not just text similarity

Return JSON array of clusters:
{{
  "cluster_id": "C1",
  "representative_pain_point": "clear statement representing the cluster",
  "member_ids": ["PP1", "PP2"],
  "category": "business" or "technology",
  "severity": "highest severity in cluster",
  "combined_impact": "overall impact of this cluster",
  "recommended_action": "specific action to address this cluster"
}}

If pain points are genuinely distinct, keep them in separate clusters."""

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


def build_proposals(raw_points: List[str], options: Dict[str, Any]) -> Dict[str, Any]:
    """Main function to build pain point proposals using AI analysis."""
    context = options.get("context", "")
    
    # If raw_points is a list of strings, treat as separate lines
    if raw_points and isinstance(raw_points[0], str):
        raw_text = "\n".join(raw_points)
    else:
        raw_text = str(raw_points)
    
    # Use async event loop for AI calls
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        # Extract pain points using AI
        extracted_points = loop.run_until_complete(
            extract_pain_points_from_text(raw_text, context)
        )
        
        # Cluster similar pain points
        clusters = loop.run_until_complete(
            cluster_pain_points(extracted_points, context)
        )
        
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
        
    finally:
        loop.close()


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
