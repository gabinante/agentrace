import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaybackSpeed, ReplayStep } from "../types";

export interface UseReplayPlaybackReturn {
  currentStepIndex: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBack: () => void;
  seekTo: (index: number) => void;
  setSpeed: (speed: PlaybackSpeed) => void;
}

function clampDelay(ms: number): number {
  return Math.max(100, Math.min(3000, ms));
}

export function useReplayPlayback(steps: ReplayStep[]): UseReplayPlaybackReturn {
  const [currentStepIndex, setCurrentStepIndex] = useState(
    steps.length > 0 ? steps.length - 1 : -1,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepsRef = useRef(steps);
  const speedRef = useRef(speed);
  const currentRef = useRef(currentStepIndex);

  // Keep refs in sync — intentionally updating in an effect so callbacks
  // always see the latest values without needing re-creation.
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    currentRef.current = currentStepIndex;
  }, [currentStepIndex]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleNext = useCallback(() => {
    clearTimer();
    const idx = currentRef.current;
    const allSteps = stepsRef.current;

    if (idx >= allSteps.length - 1) {
      setIsPlaying(false);
      return;
    }

    const current = allSteps[idx];
    const next = allSteps[idx + 1];

    let delay: number;
    if (current && next) {
      const delta = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
      delay = clampDelay(delta) / speedRef.current;
    } else {
      delay = 500 / speedRef.current;
    }

    timerRef.current = setTimeout(() => {
      setCurrentStepIndex((prev) => {
        const nextIdx = prev + 1;
        currentRef.current = nextIdx;
        return nextIdx;
      });
    }, delay);
  }, [clearTimer]);

  useEffect(() => {
    if (!isPlaying) {
      clearTimer();
      return;
    }
    scheduleNext();
    return clearTimer;
  }, [isPlaying, currentStepIndex, clearTimer, scheduleNext]);

  // Reset playback state when the steps array changes (e.g. data source toggle).
  useEffect(() => {
    clearTimer();
    setIsPlaying(false); // eslint-disable-line react-hooks/set-state-in-effect
    setCurrentStepIndex(steps.length > 0 ? steps.length - 1 : -1);
  }, [steps, clearTimer]);

  const play = useCallback(() => {
    // Always replay from the beginning
    setCurrentStepIndex(0);
    currentRef.current = 0;
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentStepIndex((prev) => {
      const next = Math.min(prev + 1, stepsRef.current.length - 1);
      currentRef.current = next;
      return next;
    });
  }, []);

  const stepBack = useCallback(() => {
    setIsPlaying(false);
    setCurrentStepIndex((prev) => {
      const next = Math.max(prev - 1, 0);
      currentRef.current = next;
      return next;
    });
  }, []);

  const seekTo = useCallback(
    (index: number) => {
      clearTimer();
      const clamped = Math.max(0, Math.min(index, stepsRef.current.length - 1));
      setCurrentStepIndex(clamped);
      currentRef.current = clamped;
    },
    [clearTimer],
  );

  const handleSetSpeed = useCallback((s: PlaybackSpeed) => {
    setSpeed(s);
    speedRef.current = s;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (isPlaying) pause();
          else play();
          break;
        case "ArrowRight":
          e.preventDefault();
          stepForward();
          break;
        case "ArrowLeft":
          e.preventDefault();
          stepBack();
          break;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isPlaying, play, pause, stepForward, stepBack]);

  return {
    currentStepIndex,
    isPlaying,
    speed,
    play,
    pause,
    stepForward,
    stepBack,
    seekTo,
    setSpeed: handleSetSpeed,
  };
}
