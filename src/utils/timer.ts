import { useEffect, useState } from "react";

import { GameSession } from "../game/types";
import { getElapsedSeconds } from "../services/gameService";

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function useLiveElapsedSeconds(session: GameSession | null): number {
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    session ? getElapsedSeconds(session) : 0
  );

  useEffect(() => {
    setElapsedSeconds(session ? getElapsedSeconds(session) : 0);

    if (!session || session.status !== "playing") {
      return undefined;
    }

    const interval = setInterval(() => {
      setElapsedSeconds(getElapsedSeconds(session));
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [session?.levelId, session?.status, session?.startedAt, session?.elapsedSeconds]);

  return elapsedSeconds;
}
