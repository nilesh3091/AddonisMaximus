/* Shared card renderer so the window (scroll) and the home-screen (carousel)
   render identical cards from a section key. */
import React from "react";
import { GoalsCard, ActivityCard, StreakCard } from "./cards-core.jsx";
import { ForecastCard, AnswerButtonsCard, HourlyCard, FsrsCard, DeckBoardCard, RecordsCard, AchievementsCard } from "./cards-extra.jsx";

export function renderCard(key, ctx) {
  const { anki, range, chartType, onAddGoal } = ctx;
  switch (key) {
    case "goals": return <GoalsCard anki={anki} range={range} onAddGoal={onAddGoal} />;
    case "activity": return <ActivityCard anki={anki} range={range} chartType={chartType} />;
    case "streak": return <StreakCard anki={anki} />;
    case "forecast": return <ForecastCard anki={anki} />;
    case "answerButtons": return <AnswerButtonsCard anki={anki} range={range} />;
    case "hourly": return <HourlyCard anki={anki} />;
    case "fsrs": return <FsrsCard anki={anki} />;
    case "deckBoard": return <DeckBoardCard anki={anki} range={range} />;
    case "records": return <RecordsCard anki={anki} />;
    case "achievements": return <AchievementsCard anki={anki} />;
    default: return null;
  }
}
