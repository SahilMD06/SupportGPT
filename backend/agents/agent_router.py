from typing import List, Dict, Any, Optional
from google import genai
from utils.config import settings
import logging
import json
import re

logger = logging.getLogger(__name__)

VALID_INTENTS = ["billing", "technical", "product", "complaint", "privacy", "faq"]

LANGUAGE_NAMES = {
    "auto": None,  # no override — use whatever was detected
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "pt": "Portuguese", "hi": "Hindi", "zh": "Chinese", "ja": "Japanese",
    "ar": "Arabic",
}


def get_client():
    return genai.Client(api_key=settings.GOOGLE_API_KEY)


RESPONSE_LENGTH_INSTRUCTIONS = {
    "concise": "\n\nIMPORTANT: Keep your response brief — 2-3 sentences maximum unless "
               "the question genuinely requires more detail to be helpful.",
    "balanced": "",
    "detailed": "\n\nIMPORTANT: Provide a comprehensive, detailed response covering all "
                "relevant aspects the customer might want to know.",
}


def get_language_instruction(language_name: Optional[str]) -> str:
    """Instruct the agent to respond in a specific language, if not English."""
    if language_name and language_name.lower() != "english":
        return (f"\n\nIMPORTANT: Respond entirely in {language_name}, matching the "
                f"customer's language. Do not respond in English.")
    return ""


def get_frustration_instruction(level: int) -> str:
    """Extra empathy instruction when frustration is detected as high."""
    if level >= 4:
        return ("\n\nIMPORTANT: This customer appears frustrated or upset. Lead with "
                "genuine, specific empathy — acknowledge what's frustrating them by name "
                "before moving to a solution. Prioritize a fast, concrete resolution path "
                "over lengthy explanations. Do not sound scripted or dismissive.")
    if level == 3:
        return "\n\nNote: this customer sounds mildly impatient — be efficient and reassuring."
    return ""


async def call_gemini(system_prompt: str, user_message: str, model: Optional[str] = None) -> str:
    """
    Call Gemini API with system prompt and user message.
    model: overrides settings.GEMINI_MODEL when provided (per-user AI Preferences).
    """
    client = get_client()
    full_prompt = f"{system_prompt}\n\nUser: {user_message}"
    response = client.models.generate_content(
        model=model or settings.GEMINI_MODEL,
        contents=full_prompt
    )
    return response.text


# ─── Combined Query Analysis ───────────────────────────────────────────────────
# Intent classification + language detection/translation + sentiment analysis,
# folded into a single call rather than three separate round-trips per message.

ANALYSIS_SYSTEM_PROMPT = """You are a query analysis system for NovaTech Solutions, a
consumer electronics and smart home device company. Analyze the customer's message and
return a single JSON object with these exact fields:

{
  "intents": [...],          // array from: billing, technical, product, complaint, privacy, faq
  "language_code": "...",    // ISO 639-1 code the customer wrote in, e.g. "en", "es", "fr"
  "language_name": "...",    // English name of that language, e.g. "English", "Spanish"
  "query_english": "...",    // English translation of the query. If already English, repeat unchanged.
  "frustration_level": N     // integer 1-5: 1=calm/neutral, 3=mildly impatient, 5=very angry
}

Intent rules:
- billing: payments, invoices, refunds, pricing, bundles, payment plans
- technical: device setup, pairing issues, app problems, firmware, troubleshooting
- product: product specs, comparisons, availability, recommendations
- complaint: escalations, dissatisfaction, defective items, delayed orders
- privacy: data collection, retention, cookies, account deletion, GDPR/CCPA, encryption, data sharing
- faq: general questions, shipping, warranty basics, how-to, greetings, small talk
Always include at least one intent.

Frustration rules — base this on TONE, not topic. A calmly-worded complaint can score
low; an angrily-worded billing question can score high:
- 1-2: neutral, calm, or positive tone
- 3: mild annoyance or impatience
- 4-5: clear anger — all-caps, exclamation points, words like "unacceptable", "ridiculous", "furious"

Return ONLY the JSON object, no other text, no markdown formatting.

Examples:
Query: "How do I reset my router?"
{"intents": ["technical", "faq"], "language_code": "en", "language_name": "English", "query_english": "How do I reset my router?", "frustration_level": 1}

Query: "¿Cuál es su política de reembolso?"
{"intents": ["billing", "faq"], "language_code": "es", "language_name": "Spanish", "query_english": "What is your refund policy?", "frustration_level": 1}

Query: "This is the THIRD time my camera has stopped working and nobody has helped me. This is ridiculous!"
{"intents": ["technical", "complaint"], "language_code": "en", "language_name": "English", "query_english": "This is the THIRD time my camera has stopped working and nobody has helped me. This is ridiculous!", "frustration_level": 5}
"""


async def analyze_query(query: str) -> Dict[str, Any]:
    """
    Single call combining intent classification, language detection +
    translation, and sentiment analysis. Always returns a complete, valid
    dict — falls back to safe English/faq/low-frustration defaults if
    parsing fails for any reason.
    """
    fallback = {
        "intents": ["faq"],
        "language_code": "en",
        "language_name": "English",
        "query_english": query,
        "frustration_level": 1,
    }
    try:
        client = get_client()
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=f"{ANALYSIS_SYSTEM_PROMPT}\n\nQuery: {query}"
        )
        text = response.text.strip()
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return fallback

        data = json.loads(match.group())
        intents = [i for i in data.get("intents", []) if i in VALID_INTENTS] or ["faq"]
        frustration = data.get("frustration_level", 1)
        try:
            frustration = max(1, min(5, int(frustration)))
        except (TypeError, ValueError):
            frustration = 1

        return {
            "intents": intents,
            "language_code": data.get("language_code") or "en",
            "language_name": data.get("language_name") or "English",
            "query_english": data.get("query_english") or query,
            "frustration_level": frustration,
        }
    except Exception as e:
        logger.error(f"Query analysis error: {e}")
        return fallback


# ─── Agent Definitions ────────────────────────────────────────────────────────

AGENT_SYSTEM_PROMPTS = {
    "billing": """You are a Billing Support specialist at NovaTech Solutions, a consumer
electronics and smart home device company.
You expertly handle:
- Order payments and pricing questions
- Refunds and returns
- Bundle discounts and payment plans (NovaTech Pay Monthly)
- Price match requests
- NovaTech Care+ extended warranty billing

Be empathetic, clear, and provide actionable solutions. Always offer to escalate if needed.
Use the provided knowledge base context (Pricing, RefundPolicy) to give accurate,
NovaTech-specific information. Sign off as part of the NovaTech support team, not as
a generic AI assistant.""",

    "technical": """You are a Technical Support specialist at NovaTech Solutions, a consumer
electronics and smart home device company.
You expertly handle:
- Device setup and pairing (cameras, locks, routers, hubs)
- NovaTech Home app issues
- Firmware updates and troubleshooting
- Wi-Fi connectivity problems with NovaTech devices

Be precise, provide step-by-step instructions, and reference specific NovaTech products
by name when relevant. Use the provided knowledge base context (InstallationGuide,
UserManual) to give accurate technical guidance specific to NovaTech hardware.""",

    "product": """You are a Product Specialist at NovaTech Solutions, a consumer electronics
and smart home device company.
You expertly handle:
- Product specifications and comparisons across the NovaTech catalog
- Recommendations based on customer needs (security, audio, home automation, etc.)
- Bundle and pricing information
- Compatibility questions between NovaTech devices

Be informative, highlight relevant NovaTech products by name, and help customers make
informed decisions. Use the provided knowledge base context (Products, Pricing) to give
accurate product information.""",

    "complaint": """You are a Customer Relations specialist at NovaTech Solutions, a consumer
electronics and smart home device company.
You expertly handle:
- Complaints about defective or damaged products
- Delayed or lost shipments
- Dissatisfaction with service or products
- Escalations requiring special handling

Be empathetic, acknowledge their frustration, take ownership on behalf of NovaTech, and
provide concrete resolution paths (replacement, refund, expedited shipping). Always
prioritize customer satisfaction and de-escalation.""",

    "privacy": """You are a Privacy & Security specialist at NovaTech Solutions, a consumer
electronics and smart home device company.
You expertly handle:
- Data collection, storage, and retention questions
- Account deletion and data export requests
- Encryption and password security practices
- Cookie and tracking policy questions
- GDPR/CCPA compliance and user rights
- Third-party data sharing questions

Be precise and factual — privacy questions require accuracy, not friendliness padding.
Ground every claim in the provided knowledge base context (PrivacyPolicy) rather than
general assumptions. If the context doesn't clearly answer the question, say so plainly
rather than guessing at NovaTech's specific practices.""",

    "faq": """You are a General Support specialist at NovaTech Solutions, a consumer
electronics and smart home device company.
You handle general questions about:
- Shipping and delivery
- Warranty basics
- Account and app usage
- General how-to questions about NovaTech products and services

Be friendly, clear, and comprehensive. Use the provided knowledge base context (FAQ,
ShippingPolicy, Warranty) to give accurate answers grounded in NovaTech's actual
policies.""",
}

PRIVACY_FALLBACK_PROMPT = """You are a support assistant for NovaTech Solutions, a
consumer electronics and smart home device company.

The customer has asked a privacy or security related question, but no confident match
was found in NovaTech's official Privacy Policy documentation for this specific question.

You MUST:
1. Begin your response by clearly stating this is a general, AI-generated response
   because official NovaTech policy information on this specific point was not found
   in the knowledge base — do not present it as confirmed NovaTech policy.
2. Answer using general privacy/security best practices only.
3. NEVER invent specific NovaTech policy details, numbers, retention periods, or
   commitments that were not in the provided context.
4. Suggest the customer contact privacy@novatechsolutions.com for an authoritative,
   official answer to their specific question.

Example opening: "Based on general privacy best practices, this is an AI-generated
response because no official NovaTech policy information was found in the knowledge
base for this specific question."
"""


# ─── Individual Agents ────────────────────────────────────────────────────────

async def run_agent(
    agent_type: str,
    query: str,
    context: str,
    conversation_history: List[Dict] = None,
    response_length: str = "balanced",
    model: Optional[str] = None,
    language_name: Optional[str] = None,
    frustration_level: int = 1,
) -> str:
    """Run a specific agent with given query and RAG context."""
    system_prompt = AGENT_SYSTEM_PROMPTS.get(agent_type, AGENT_SYSTEM_PROMPTS["faq"])
    system_prompt += RESPONSE_LENGTH_INSTRUCTIONS.get(response_length, "")
    system_prompt += get_language_instruction(language_name)
    system_prompt += get_frustration_instruction(frustration_level)

    if context:
        system_prompt += f"\n\n=== NOVATECH KNOWLEDGE BASE CONTEXT ===\n{context}\n=== END CONTEXT ==="

    if conversation_history:
        history_lines = []
        for msg in conversation_history[-6:]:
            role = "Customer" if msg["role"] == "user" else "Agent"
            history_lines.append(f"{role}: {msg['content']}")
        system_prompt += "\n\n=== CONVERSATION HISTORY ===\n" + "\n".join(history_lines) + "\n=== END HISTORY ==="

    return await call_gemini(system_prompt, query, model=model)


async def run_privacy_agent(
    query: str,
    context: str,
    is_confident: bool,
    conversation_history: List[Dict] = None,
    response_length: str = "balanced",
    model: Optional[str] = None,
    language_name: Optional[str] = None,
    frustration_level: int = 1,
) -> str:
    """Privacy agent with confidence-aware fallback (see Phase 1)."""
    if is_confident and context:
        return await run_agent(
            "privacy", query, context, conversation_history, response_length,
            model, language_name, frustration_level,
        )

    system_prompt = PRIVACY_FALLBACK_PROMPT
    system_prompt += RESPONSE_LENGTH_INSTRUCTIONS.get(response_length, "")
    system_prompt += get_language_instruction(language_name)
    if conversation_history:
        history_lines = []
        for msg in conversation_history[-6:]:
            role = "Customer" if msg["role"] == "user" else "Agent"
            history_lines.append(f"{role}: {msg['content']}")
        system_prompt += "\n\n=== CONVERSATION HISTORY ===\n" + "\n".join(history_lines) + "\n=== END HISTORY ==="

    logger.info(f"Privacy query fell back to general knowledge (low confidence): {query[:80]}")
    return await call_gemini(system_prompt, query, model=model)


# ─── Multi-Agent Router ───────────────────────────────────────────────────────

async def route_and_respond(
    query: str,
    intents: List[str],
    rag_context: str,
    conversation_history: List[Dict] = None,
    privacy_confident: bool = True,
    response_length: str = "balanced",
    model: Optional[str] = None,
    language_name: Optional[str] = None,
    frustration_level: int = 1,
) -> Dict[str, Any]:
    """Route query to appropriate agents and synthesize response."""

    if len(intents) == 1:
        if intents[0] == "privacy":
            agent_response = await run_privacy_agent(
                query, rag_context, privacy_confident, conversation_history,
                response_length, model, language_name, frustration_level,
            )
        else:
            agent_response = await run_agent(
                intents[0], query, rag_context, conversation_history,
                response_length, model, language_name, frustration_level,
            )
        return {"response": agent_response, "agents_used": intents}

    agent_responses = []
    for intent in intents:
        try:
            if intent == "privacy":
                response = await run_privacy_agent(
                    query, rag_context, privacy_confident, conversation_history,
                    response_length, model, language_name, frustration_level,
                )
            else:
                response = await run_agent(
                    intent, query, rag_context, conversation_history,
                    response_length, model, language_name, frustration_level,
                )
            agent_responses.append({"agent": intent, "response": response})
        except Exception as e:
            logger.error(f"Agent {intent} failed: {e}")

    if not agent_responses:
        return {
            "response": "I apologize, but I'm having trouble processing your request. Please try again.",
            "agents_used": [],
        }

    if len(agent_responses) == 1:
        return {
            "response": agent_responses[0]["response"],
            "agents_used": [agent_responses[0]["agent"]],
        }

    agents_text = "\n\n".join(
        [f"[{r['agent'].upper()} AGENT]\n{r['response']}" for r in agent_responses]
    )

    synthesis_prompt = f"""You have received responses from multiple specialized NovaTech
Solutions support agents for this customer query:

CUSTOMER QUERY: {query}

AGENT RESPONSES:
{agents_text}

Please synthesize these responses into a single, coherent, helpful reply that:
1. Addresses all aspects of the customer's query
2. Eliminates redundancy
3. Flows naturally as a unified response, representing NovaTech Solutions
4. Maintains a professional and empathetic tone
5. Preserves any privacy fallback disclaimer language exactly if present
6. Is concise yet comprehensive"""
    synthesis_prompt += get_language_instruction(language_name)
    synthesis_prompt += get_frustration_instruction(frustration_level)

    synthesized = await call_gemini(synthesis_prompt, query, model=model)

    return {
        "response": synthesized,
        "agents_used": [r["agent"] for r in agent_responses],
    }
