from langchain.prompts import PromptTemplate

# Pain Point Extraction Prompt (ported and adapted)

pain_point_extraction_prompt = PromptTemplate(
    template=(
        """You are a senior management consultant (MBA) and organisational psychologist (PhD).
Extract every distinct pain point from the text and return them as clear, single sentences.

Requirements:
- Each pain point should be one complete, standalone sentence
- Use Australian English with proper grammar
- Focus on the core problem or challenge
- Be specific about what the pain point is
- Keep each sentence concise but descriptive
- Do not include metrics or specific numbers unless essential to understanding the problem

Format: Return only a simple list, one pain point per line, like this:
Social media engagement rates are consistently below industry benchmarks across all platforms.
Website conversion rates are underperforming expected targets.
Customer data access is limited by system restrictions.

{additional_prompts}

Text to analyse:
{data}
"""
    ),
    input_variables=["additional_prompts", "data"],
)

# Theme & Perspective Mapping Prompt
theme_perspective_mapping_prompt = PromptTemplate(
    input_variables=["pain_points", "themes", "perspectives", "additional_context"],
    template=(
        """You are an expert management consultant specialising in organisational analysis.

Your task: Map each pain point to the MOST APPROPRIATE theme and perspective from the provided lists.

Pain Points to Map:
{pain_points}
Available Themes:
{themes}
Available Perspectives:
{perspectives}
Additional Context: {additional_context}

Instructions:
1. For each pain point, analyse and determine which theme best categorises it
2. For each pain point, determine which perspective best represents the viewpoint/domain
3. Choose exactly one theme and one perspective for each pain point
4. Return your response in this exact format (one set per pain point):
PAIN_POINT_ID -> THEME: [theme_name] | PERSPECTIVE: [perspective_name]
5. Do NOT use any formatting like bold (**), italics (*), or backticks (`) in your response
6. Use plain text only for all IDs, themes, and perspectives

Example format:
PP001 -> THEME: Technology Limitations | PERSPECTIVE: Technology
PP002 -> THEME: Manual Processes | PERSPECTIVE: Process
PP003 -> THEME: Skills & Capacity | PERSPECTIVE: People

Mappings:"""
    ),
)

# Capability Mapping Prompt
pain_point_capability_mapping_prompt = PromptTemplate(
    input_variables=["pain_points", "capabilities", "additional_context"],
    template=(
        """You are an expert management consultant specialising in organisational capabilities.\n\n"
        "Your task: Match each pain point to the MOST APPROPRIATE capability from the provided list.\n\n"
        "Pain Points to Match:\n{pain_points}\n"
        "Available Capabilities:\n{capabilities}\n"
        "Additional Context: {additional_context}\n\n"
        "Instructions:\n"
        "1. For each pain point, analyse and determine which capability would best address it\n"
        "2. Consider both direct solutions and preventive capabilities\n"
        "3. Choose the single most appropriate capability ID for each pain point\n"
        "4. Return your response in this exact format (one line per pain point):\n"
        "PAIN_POINT_ID -> CAPABILITY_ID\n\n"
        "Example format:\n"
        "PP001 -> CAP003\nPP002 -> CAP007\nPP003 -> CAP001\n\n"
        "Mappings:"""
    ),
)

# Impact Estimation Prompt
impact_estimation_prompt = PromptTemplate(
    input_variables=["pain_points", "additional_context"],
    template=(
        """You are an experienced delivery and product manager. Score each pain point using the following rubric.\n\n"
        "Rubric:\n"
        "- SEVERITY (1-10): how serious the impact is when it occurs\n"
        "- FREQUENCY (1-10): how often it occurs\n"
        "- EFFORT (1-10): estimated effort to address (higher = more effort)\n"
        "- COST (Low|Medium|High): rough cost band to address\n"
        "- COMPOSITE (0-100): overall priority score (you decide the formula, but be consistent)\n\n"
        "Pain Points to Score:\n{pain_points}\n"
        "Additional Context: {additional_context}\n\n"
        "Output strictly in this format (one line per pain point):\n"
        "PAIN_POINT_ID -> SEVERITY: n | FREQUENCY: n | EFFORT: n | COST: Low|Medium|High | COMPOSITE: n\n\n"
        "Example:\n"
        "PP001 -> SEVERITY: 7 | FREQUENCY: 8 | EFFORT: 5 | COST: Medium | COMPOSITE: 72\n\n"
        "Scores:"""
    ),
)
