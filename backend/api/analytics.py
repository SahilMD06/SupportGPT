from fastapi import APIRouter, Depends
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from typing import List

from models.schemas import AnalyticsResponse, AgentUsageStat, SentimentStat, LanguageStat
from services.database import get_collection
from utils.auth import get_current_user

router = APIRouter()


@router.get("", response_model=AnalyticsResponse)
async def get_analytics(current_user: dict = Depends(get_current_user)):
    """Get platform analytics data."""
    analytics = get_collection("analytics")
    users = get_collection("users")
    conversations = get_collection("conversations")

    # Totals
    total_chats = await analytics.count_documents({})
    total_users = await users.count_documents({})

    # Average response time
    pipeline_avg = [
        {"$group": {"_id": None, "avg_time": {"$avg": "$response_time_ms"}}}
    ]
    avg_result = await analytics.aggregate(pipeline_avg).to_list(length=1)
    avg_response_time = avg_result[0]["avg_time"] if avg_result else 0.0

    # Pull all records once — used for agent usage, intents, daily trend,
    # sentiment, and language breakdowns
    all_records = await analytics.find(
        {}, {"agents_used": 1, "intents": 1, "timestamp": 1, "frustration_level": 1, "language_name": 1}
    ).to_list(length=5000)

    agent_counter = Counter()
    intent_counter = Counter()
    day_counter = defaultdict(int)
    language_counter = Counter()

    frustration_values = []
    frustration_by_day = defaultdict(list)
    low_frustration = medium_frustration = high_frustration = 0

    for record in all_records:
        for agent in record.get("agents_used", []):
            agent_counter[agent] += 1
        for intent in record.get("intents", []):
            intent_counter[intent] += 1

        ts = record.get("timestamp")
        day_key = ts.strftime("%Y-%m-%d") if ts else None
        if day_key:
            day_counter[day_key] += 1

        lang = record.get("language_name")
        if lang:
            language_counter[lang] += 1

        frustration = record.get("frustration_level")
        if frustration is not None:
            frustration_values.append(frustration)
            if day_key:
                frustration_by_day[day_key].append(frustration)
            if frustration <= 2:
                low_frustration += 1
            elif frustration == 3:
                medium_frustration += 1
            else:
                high_frustration += 1

    # Agent usage stats
    total_agent_uses = sum(agent_counter.values()) or 1
    agent_usage = [
        AgentUsageStat(
            agent=agent,
            count=count,
            percentage=round((count / total_agent_uses) * 100, 1),
        )
        for agent, count in agent_counter.most_common()
    ]

    # Chats per day (last 30 days)
    last_30 = datetime.utcnow() - timedelta(days=30)
    chats_per_day = []
    for i in range(30):
        day = (last_30 + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        chats_per_day.append({"date": day, "count": day_counter.get(day, 0)})

    # Most common intents
    most_common_intents = [
        {"intent": intent, "count": count}
        for intent, count in intent_counter.most_common(10)
    ]

    # Sentiment / frustration
    avg_frustration = round(sum(frustration_values) / len(frustration_values), 2) if frustration_values else 0.0
    frustration_trend = []
    for i in range(30):
        day = (last_30 + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        values = frustration_by_day.get(day, [])
        avg_for_day = round(sum(values) / len(values), 2) if values else None
        frustration_trend.append({"date": day, "avg_frustration": avg_for_day})

    sentiment = SentimentStat(
        avg_frustration=avg_frustration,
        low_frustration_count=low_frustration,
        medium_frustration_count=medium_frustration,
        high_frustration_count=high_frustration,
        frustration_trend=frustration_trend,
    )

    # Language distribution
    total_language_uses = sum(language_counter.values()) or 1
    languages = [
        LanguageStat(
            language_name=lang,
            count=count,
            percentage=round((count / total_language_uses) * 100, 1),
        )
        for lang, count in language_counter.most_common(10)
    ]

    return AnalyticsResponse(
        total_chats=total_chats,
        total_users=total_users,
        avg_response_time_ms=round(avg_response_time, 2),
        agent_usage=agent_usage,
        intent_distribution=dict(intent_counter),
        chats_per_day=chats_per_day,
        most_common_intents=most_common_intents,
        sentiment=sentiment,
        languages=languages,
    )
