# Portfolio Analysis Backend API Documentation

This document describes the new backend endpoints implemented for the Future State Application Portfolio Analysis feature.

## Overview

The portfolio analysis system provides AI-powered analysis of application portfolios based on capabilities, pain points, and application mappings. It includes both individual capability analysis and cross-application harmonization.

## Endpoints

### 1. General LLM Chat Endpoint

**POST** `/ai/llm/chat`

A general-purpose endpoint for direct LLM conversations.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user|assistant|system",
      "content": "Message content"
    }
  ],
  "temperature": 0.7,  // Optional: 0-2
  "max_tokens": 1000   // Optional: maximum response tokens
}
```

**Response:**
```json
{
  "response": "LLM response content",
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 100,
    "total_tokens": 150
  }
}
```

### 2. Individual Capability Analysis

**POST** `/ai/applications/portfolio/analyze-capability`

Analyzes a single capability against related pain points and affected applications.

**Request Body:**
```json
{
  "capability": {
    "id": "CAP-001",
    "text_content": "Capability description"
  },
  "related_pain_points": [
    {
      "pain_point_id": "PP-001",
      "pain_point_desc": "Pain point description",
      "capability_id": "CAP-001"
    }
  ],
  "affected_applications": [
    {
      "id": "APP-001",
      "text_content": "Application description"
    }
  ],
  "all_applications": [
    {
      "id": "APP-001",
      "text_content": "Application description"
    }
  ]
}
```

**Response:**
```json
{
  "capability": "CAP-001",
  "pain_points": ["List of pain point descriptions"],
  "affected_applications": ["APP-001"],
  "recommendation": "Detailed recommendation text",
  "priority": "High|Medium|Low",
  "impact": "Description of business impact",
  "effort": "Description of implementation effort"
}
```

### 3. Recommendation Harmonization

**POST** `/ai/applications/portfolio/harmonize`

Harmonizes multiple capability recommendations across applications to avoid conflicts and optimize implementation.

**Request Body:**
```json
{
  "recommendations": [
    {
      "capability": "CAP-001",
      "pain_points": ["Pain point descriptions"],
      "affected_applications": ["APP-001"],
      "recommendation": "Recommendation text",
      "priority": "High",
      "impact": "Impact description",
      "effort": "Effort description"
    }
  ],
  "applications": [
    {
      "id": "APP-001",
      "text_content": "Application description"
    }
  ]
}
```

**Response:**
```json
{
  "harmonized_recommendations": [
    {
      "application": "APP-001",
      "actions": ["Specific action items"],
      "overall_priority": "High|Medium|Low",
      "total_impact": "Overall impact description",
      "consolidated_rationale": "Explanation of harmonized approach"
    }
  ]
}
```

### 4. Complete Portfolio Analysis

**POST** `/ai/applications/portfolio/analyze`

Runs the complete portfolio analysis workflow, combining capability analysis and harmonization.

**Request Body:**
```json
{
  "capabilities": [
    {
      "id": "CAP-001",
      "text_content": "Capability description"
    }
  ],
  "applications": [
    {
      "id": "APP-001",
      "text_content": "Application description"
    }
  ],
  "pain_point_mappings": [
    {
      "pain_point_id": "PP-001",
      "pain_point_desc": "Pain point description",
      "capability_id": "CAP-001"
    }
  ],
  "application_mappings": [
    {
      "id": "APP-001",
      "text_content": "Application with capability mapping info"
    }
  ]
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "capability": "CAP-001",
      "pain_points": ["Pain points"],
      "affected_applications": ["APP-001"],
      "recommendation": "Recommendation",
      "priority": "High",
      "impact": "Impact",
      "effort": "Effort"
    }
  ],
  "harmonized_recommendations": [
    {
      "application": "APP-001",
      "actions": ["Actions"],
      "overall_priority": "High",
      "total_impact": "Impact",
      "consolidated_rationale": "Rationale"
    }
  ],
  "summary": {
    "total_capabilities": 1,
    "total_applications": 1,
    "high_priority_actions": 1,
    "total_recommendations": 1,
    "applications_affected": 1
  }
}
```

## Error Responses

All endpoints return standard HTTP error responses:

**503 Service Unavailable** - LLM not configured
```json
{
  "detail": "LLM not configured"
}
```

**500 Internal Server Error** - Processing failed
```json
{
  "detail": "Detailed error message"
}
```

## Frontend Integration

The corresponding frontend API routes are available at:

- `/api/ai/llm/chat`
- `/api/ai/applications/portfolio/analyze-capability`
- `/api/ai/applications/portfolio/harmonize`
- `/api/ai/applications/portfolio/analyze`

These proxy requests to the backend and maintain the same request/response formats.

## Prerequisites

1. **LLM Configuration**: OpenAI API key must be configured in environment variables
2. **Backend Dependencies**: LangChain and related dependencies must be installed
3. **Model Access**: The configured model (default: gpt-4o-mini) must be accessible

## Testing

Use the included test script to verify endpoints:

```bash
cd backend
python test_portfolio_endpoints.py
```

The test script will verify:
- LLM health and connectivity
- Individual capability analysis
- Recommendation harmonization  
- Complete portfolio analysis workflow

## Implementation Notes

### JSON Parsing
The LLM responses are parsed as JSON with fallback handling for malformed responses. If JSON parsing fails, the system provides sensible defaults based on the input data.

### Concurrent Processing
The system uses concurrent processing for multiple capability analyses while respecting rate limits and maintaining response quality.

### Error Handling
Each endpoint includes comprehensive error handling with descriptive error messages to aid in debugging and user feedback.

### Response Validation
All responses are validated against Pydantic models to ensure consistent data structures and type safety.
