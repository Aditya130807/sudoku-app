import { useEffect, useRef, useState } from "react";

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
    session ? getElapsedSeconds(session) : 0,
  );
  const sessionRef = useRef<GameSession | null>(session);

  useEffect(() => {
    sessionRef.current = session;
    setElapsedSeconds(session ? getElapsedSeconds(session) : 0);
  }, [session]);

  useEffect(() => {
    const activeSession = sessionRef.current;

    if (!activeSession || activeSession.status !== "playing") {
      return undefined;
    }

    const interval = setInterval(() => {
      const currentSession = sessionRef.current;

      if (!currentSession || currentSession.status !== "playing") {
        return;
      }

      setElapsedSeconds(getElapsedSeconds(currentSession));
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [session?.status, session?.startedAt]);

  return elapsedSeconds;
}
