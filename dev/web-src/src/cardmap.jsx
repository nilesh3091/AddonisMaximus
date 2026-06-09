/* Shared card renderer so the window (scroll) and the home-screen (carousel)
   render identical cards from a section key. */
import React from "react";
import { GoalsCard, ActivityCard, StreakCard } from "./cards-core.jsx";
import { ForecastCard, AnswerButtonsCard, HourlyCard, FsrsCard, DeckBoardCard, BestDaysCard, RecordsCard, AchievementsCard } from "./cards-extra.jsx";

export function renderCard(key, ctx) {
  const { anki, range, chartType, onAddGoal, compact = false, streakBox } = ctx;
  const c = compact;
  switch (key) {
    case "goals": return <GoalsCard anki={anki} range={range} onAddGoal={onAddGoal} compact={c} />;
    case "activity": return <ActivityCard anki={anki} range={range} chartType={chartType} compact={c} />;
    case "streak": return <StreakCard anki={anki} compact={c} box={streakBox} />;
    case "forecast": return <ForecastCard anki={anki} compact={c} />;
    case "answerButtons": return <AnswerButtonsCard anki={anki} range={range} compact={c} />;
    case "hourly": return <HourlyCard anki={anki} compact={c} />;
    case "fsrs": return <FsrsCard anki={anki} compact={c} />;
    case "deckBoard": return <DeckBoardCard anki={anki} range={range} compact={c} />;
    case "bestDays": return <BestDaysCard anki={anki} compact={c} />;
    case "records": return <RecordsCard anki={anki} compact={c} />;
    case "achievements": return <AchievementsCard anki={anki} compact={c} />;
    default: return null;
  }
}
