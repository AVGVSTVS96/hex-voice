import type { TextInputRef } from "@expo/ui";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { TASKS } from "@/call/stage";
import type { AskId } from "@/live/asks";
import type { PageId, Tab } from "@/live/inbox";
import type { TaskId } from "@/live/tasks";
import type { Page } from "@/screens/layout";

import type { Shape } from "../../../modules/pages";

export type Level = "list" | "topic" | "thread" | "steps" | "check" | "picks" | "pick";

type Pushed = Exclude<Level, "list">;

export interface Asking {
  id: AskId;
  open?: "reply" | "camera" | undefined;
}

export interface TasksAt {
  task?: TaskId | undefined;
  stage?: Tab | undefined;
  ask?: Asking | undefined;
}

export interface Stack {
  path: Pushed[];
  task: PageId | null;
  row: string | null;
  stepsOf: TaskId | null;
  pick: AskId | null;
  focusComposer: boolean;
  stage: Tab | null;
  query: string | null;
  ask: Asking | null;
}

export type Move =
  | { to: "topic"; id: PageId | null; row?: string | undefined; ask?: Asking | undefined }
  | { to: "thread"; write?: boolean }
  | { to: "composerFocused" }
  | { to: "steps"; id: TaskId }
  | { to: "check" }
  | { to: "picks" }
  | { to: "pick"; id: AskId }
  | { to: "back" }
  | { to: "stage"; stage: Tab }
  | { to: "search"; query: string | null };

export type { Shape } from "../../../modules/pages";

export const START: Stack = {
  path: [],
  task: null,
  row: null,
  stepsOf: null,
  pick: null,
  focusComposer: false,
  stage: null,
  query: null,
  ask: null,
};

export const startAt = (at: TasksAt): Stack => ({
  ...START,
  task: at.task ?? null,
  path: at.task ? ["topic"] : [],
  stage: at.stage ?? null,
  ask: at.ask ?? null,
});

export const COLUMNS = { from: 900, share: 0.42, least: 360, most: 440 };

export const shapeOf = ({ width, paged, meet = 0 }: Room): Shape => {
  if (width === undefined) {
    return "one";
  }

  if (paged) {
    return Math.min(width / 2 + meet, width / 2 - meet) >= TASKS ? "panes" : "one";
  }

  return width >= COLUMNS.from ? "columns" : "one";
};

export const move = (stack: Stack, step: Move): Stack => {
  switch (step.to) {
    case "topic": {
      return {
        ...stack,
        task: step.id,
        row: step.row ?? null,
        path: step.id === null ? [] : ["topic"],
        ask: step.ask ?? null,
      };
    }

    case "thread": {
      return { ...stack, path: ["topic", "thread"], focusComposer: step.write === true };
    }

    case "composerFocused": {
      return stack.focusComposer ? { ...stack, focusComposer: false } : stack;
    }

    case "steps": {
      return {
        ...stack,
        stepsOf: step.id,
        path: [...stack.path.filter((at) => at !== "steps"), "steps"],
      };
    }

    case "check":
    case "picks": {
      return { ...stack, path: [step.to] };
    }

    case "pick": {
      return { ...stack, pick: step.id, path: ["picks", "pick"] };
    }

    case "back": {
      return { ...stack, path: stack.path.slice(0, -1), focusComposer: false };
    }

    case "stage": {
      return { ...stack, stage: step.stage };
    }

    case "search": {
      return { ...stack, query: step.query };
    }

    default: {
      return step satisfies never;
    }
  }
};

export const levelsOf = (stack: Stack, shape: Shape): Level[] => {
  const levels: Level[] = ["list", ...stack.path];

  if (shape !== "one" && levels.length === 1) {
    levels.push("topic");
  }

  return levels;
};

export const backLeavesTasks = (stack: Stack, shape: Shape): boolean => {
  const levels = levelsOf(stack, shape);

  if (shape === "one") {
    return levels.length === 1;
  }

  if (shape === "columns") {
    return levels.length === 2 && levels[1] === "topic";
  }

  return levels.at(-2) === "list";
};

export const usePages = ({
  stack,
  onMove,
  shape: guess,
  onClose,
}: {
  stack: Stack;
  onMove: (move: Move) => void;
  shape: Shape;
  onClose?: () => void;
}) => {
  const [placed, setPlaced] = useState<Shape>();
  const shape = placed ?? guess;

  const back = () => {
    if (backLeavesTasks(stack, shape)) {
      onClose?.();
    } else {
      onMove({ to: "back" });
    }
  };

  return {
    ...stack,
    shape,
    levels: levelsOf(stack, shape),
    closes: !!onClose,
    go: onMove,
    back,
    placed: setPlaced,
  };
};

export type Pages = ReturnType<typeof usePages>;

type Placing = Pick<Pages, "levels" | "shape" | "closes">;

// WHY: width only guesses the shape, from the width the container is given, until PagesView reports the shape it laid out from its own.
export interface Room {
  foot: number | "fold";
  paged: boolean;
  meet?: number;
  width?: number | undefined;
}

export const pagedRoom = ({ area, margin, foot }: Page): Room => ({
  width: area.width,
  foot,
  paged: true,
  meet: (margin.right - margin.left) / 2,
});

export interface Spot {
  shown: boolean;
  foot: number;
  back?: Level | "call" | undefined;
}

export const Typing = createContext<((on: boolean) => void) | undefined>(undefined);

export const Showing = createContext(true);

export const useField = () => {
  const field = useRef<TextInputRef>(null);
  const showing = useContext(Showing);
  useEffect(() => {
    if (!showing) {
      field.current?.blur();
    }
  }, [showing]);

  return field;
};

export const spotOf = (level: Level, { levels, shape, closes }: Placing, room: Room): Spot => {
  const i = levels.indexOf(level);
  const front = i !== -1 && i === levels.length - 1;
  const besideFront = i !== -1 && i === levels.length - 2;
  const foot = room.foot === "fold" ? 0 : room.foot;
  const listBack = closes ? "call" : undefined;

  if (shape === "panes") {
    const shown = front || besideFront;

    const before = level === "list" ? listBack : levels[i - 1];

    return { shown, foot, back: shown && !front ? before : undefined };
  }

  if (shape === "columns") {
    return {
      shown: level === "list" || front,
      foot,
      back: level === "list" || level === "topic" ? undefined : levels[i - 1],
    };
  }

  return {
    shown: front,
    foot,
    back: level === "list" ? listBack : (levels[i - 1] ?? levels.at(-1)),
  };
};
