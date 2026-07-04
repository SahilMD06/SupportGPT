from typing import List, Dict, Any
from google import genai
from utils.config import settings
import logging
import json
import re

logger = logging.getLogger(__name__)


def get_client():
    return genai.Client(api_key=settings.GOOGLE_API_KEY)


async def call_gemini(system_prompt: str, user_message: str) -> str:
    """Call Gemini API with system prompt and user message."""
    client = get_client()
    full_prompt = f"{system_prompt}\n\nUser: {user_message}"
    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=full_prompt
    )
    return response.text


# ─── Intent Classifier ────────────────────────────────────────────────────────

async def classify_intent(query: str) -> List[str]:
    """Classify user query into one or more intents."""
    system_prompt = """You are an intent classification system for a customer support platform.

Classify the user query into one or more of these intents:
- billing: payments, invoices, refunds, subscription issues, charges
- technical: login issues, bugs, errors, installation, technical problems
- product: features, pricing, comparisons, product information
- complaint: escalations, customer dissatisfaction, bad experience
- faq: general questions, how-to, basic information

Rules:
1. Return ONLY a JSON array of intent strings
2. Can return multiple intents if the query covers multiple topics
3. Always return at least one intent
4. Example: ["billing", "technical"] or ["faq"] or ["billing"]

Examples:
- "I paid but can't access premium" -> ["billing", "technical"]
- "What is your refund policy?" -> ["billing", "faq"]
- "The app keeps crashing after my payment" -> ["technical", "billing"]
- "How do I reset my password?" -> ["technical", "faq"]
- "Your service is terrible and I want a refund" -> ["complaint", "billing"]
"""
    try:
        text = await call_gemini(system_prompt, f"Classify this query: {query}")
        text = text.strip()
        match = re.search(r"\[.*?\]", text, re.DOTALL)
        if match:
            intents = json.loads(match.group())
            valid_intents = ["billing", "technical", "product", "complaint", "faq"]
            return [i for i in intents if i in valid_intents] or ["faq"]
    except Exception as e:
        logger.error(f"Intent classification error: {e}")
    return ["faq"]


# ─── Agent Definitions ────────────────────────────────────────────────────────

AGENT_SYSTEM_PROMPTS = {
    "billing": """You are a specialized Billing Support Agent for SupportGPT.
You expertly handle:
- Payment issues and failed transactions
- Invoice requests and billing history
- Refund requests and processing
- Subscription management and plan changes
- Pricing clarifications

Be empathetic, clear, and provide actionable solutions. Always offer to escalate if needed.
Use the provided context from our knowledge base to give accurate information.""",

    "technical": """You are a specialized Technical Support Agent for SupportGPT.
You expertly handle:
- Login and authentication issues
- Software bugs and errors
- Installation and setup problems
- Performance issues and troubleshooting
- API integration help

Be precise, provide step-by-step instructions, and include relevant error codes if applicable.
Use the provided context from our knowledge base to give accurate technical guidance.""",

    "product": """You are a specialized Product Information Agent for SupportGPT.
You expertly handle:
- Feature explanations and walkthroughs
- Pricing plan comparisons
- Product capabilities and limitations
- Upgrade/downgrade recommendations

Be informative, highlight value propositions, and help users make informed decisions.
Use the provided context from our knowledge base to give accurate product information.""",

    "complaint": """You are a specialized Customer Relations Agent for SupportGPT.
You expertly handle:
- Customer complaints and escalations
- Dissatisfaction and bad experiences
- Compensation requests
- Service quality issues

Be empathetic, acknowledge their frustration, take ownership, and provide concrete resolution paths.
Always prioritize customer satisfaction and de-escalation.""",

    "faq": """You are a General Support Agent for SupportGPT.
You handle general questions and provide helpful information about:
- How-to questions
- General platform usage
- Account management basics
- Policies and procedures
- Getting started guides

Be friendly, clear, and comprehensive in your explanations.
Use the provided context from our knowledge base to give accurate answers.""",
}


# ─── Individual Agents ────────────────────────────────────────────────────────

async def run_agent(
    agent_type: str,
    query: str,
    context: str,
    conversation_history: List[Dict] = None,
) -> str:
    """Run a specific agent with given query and RAG context."""
    system_prompt = AGENT_SYSTEM_PROMPTS.get(agent_type, AGENT_SYSTEM_PROMPTS["faq"])

    if context:
        system_prompt += f"\n\n=== KNOWLEDGE BASE CONTEXT ===\n{context}\n=== END CONTEXT ==="

    if conversation_history:
        history_lines = []
        for msg in conversation_history[-6:]:
            role = "Customer" if msg["role"] == "user" else "Agent"
            history_lines.append(f"{role}: {msg['content']}")
        system_prompt += "\n\n=== CONVERSATION HISTORY ===\n" + "\n".join(history_lines) + "\n=== END HISTORY ==="

    return await call_gemini(system_prompt, query)


# ─── Multi-Agent Router ───────────────────────────────────────────────────────

async def route_and_respond(
    query: str,
    intents: List[str],
    rag_context: str,
    conversation_history: List[Dict] = None,
) -> Dict[str, Any]:
    """Route query to appropriate agents and synthesize response."""

    if len(intents) == 1:
        agent_response = await run_agent(
            intents[0], query, rag_context, conversation_history
        )
        return {"response": agent_response, "agents_used": intents}

    # Multiple agents — run them and synthesize
    agent_responses = []
    for intent in intents:
        try:
            response = await run_agent(intent, query, rag_context, conversation_history)
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

    # Synthesize multiple agent responses
    agents_text = "\n\n".join(
        [f"[{r['agent'].upper()} AGENT]\n{r['response']}" for r in agent_responses]
    )

    synthesis_prompt = f"""You have received responses from multiple specialized support agents for this customer query:

CUSTOMER QUERY: {query}

AGENT RESPONSES:
{agents_text}

Please synthesize these responses into a single, coherent, helpful reply that:
1. Addresses all aspects of the customer query
2. Eliminates redundancy
3. Flows naturally as a unified response
4. Maintains a professional and empathetic tone
5. Is concise yet comprehensive"""

    synthesized = await call_gemini(synthesis_prompt, query)

    return {
        "response": synthesized,
        "agents_used": [r["agent"] for r in agent_responses],
    }