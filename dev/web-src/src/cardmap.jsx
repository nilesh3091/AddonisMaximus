/* Shared card renderer so the window (scroll) and the home-screen (carousel)
   render identical cards from a section key. */
import React from "react";
import { GoalsCard, ActivityCard, StreakCard, OverviewCard } from "./cards-core.jsx";
import { MonthCard, ForecastCard, AnswerButtonsCard, HourlyCard, BestDaysCard, MaturityCard, PendingCard, TimeSpentCard, PaceCard } from "./cards-extra.jsx";

export function renderCard(key, ctx) {
  const { anki, config, setConfig, range, chartType, onAddGoal, onShare, compact = false, streakBox } = ctx;
  const c = compact;
  switch (key) {
    case "goals": return <GoalsCard anki={anki} range={range} onAddGoal={onAddGoal} compact={c} />;
    case "activity": return <ActivityCard anki={anki} range={range} chartType={chartType} compact={c} />;
    case "overview": return <OverviewCard anki={anki} range={range} chartType={chartType} compact={c} />;
    case "month": return <MonthCard anki={anki} compact={c} />;
    case "streak": return <StreakCard anki={anki} compact={c} box={streakBox} onShare={onShare} />;
    case "pending": return <PendingCard anki={anki} compact={c} />;
    case "forecast": return <ForecastCard anki={anki} compact={c} />;
    case "answerButtons": return <AnswerButtonsCard anki={anki} range={range} compact={c} />;
    case "hourly": return <HourlyCard anki={anki} compact={c} />;
    case "bestDays": return <BestDaysCard anki={anki} compact={c} />;
    case "maturity": return <MaturityCard anki={anki} config={config} setConfig={setConfig} compact={c} />;
    case "pace": return <PaceCard anki={anki} compact={c} />;
    case "time": return <TimeSpentCard anki={anki} range={range} chartType={chartType} compact={c} />;
    default: return null;
  }
}
