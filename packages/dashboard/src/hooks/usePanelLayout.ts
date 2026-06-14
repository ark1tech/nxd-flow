import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "autopilot-panel-layout";

export interface PanelLayout {
  leftOpen: boolean;
  rightOpen: boolean;
  leftWidth: number;
  rightWidth: number;
}

const DEFAULT_LAYOUT: PanelLayout = {
  leftOpen: true,
  rightOpen: true,
  leftWidth: 300,
  rightWidth: 300
};

function readLayout(): PanelLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<PanelLayout>;
    return {
      leftOpen: parsed.leftOpen ?? DEFAULT_LAYOUT.leftOpen,
      rightOpen: parsed.rightOpen ?? DEFAULT_LAYOUT.rightOpen,
      leftWidth: clamp(parsed.leftWidth ?? DEFAULT_LAYOUT.leftWidth, 240, 520),
      rightWidth: clamp(parsed.rightWidth ?? DEFAULT_LAYOUT.rightWidth, 240, 520)
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function usePanelLayout() {
  const [layout, setLayout] = useState<PanelLayout>(readLayout);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  const setLeftOpen = useCallback((open: boolean) => {
    setLayout((current) => ({ ...current, leftOpen: open }));
  }, []);

  const setRightOpen = useCallback((open: boolean) => {
    setLayout((current) => ({ ...current, rightOpen: open }));
  }, []);

  const setLeftWidth = useCallback((width: number) => {
    setLayout((current) => ({ ...current, leftWidth: clamp(width, 240, 520) }));
  }, []);

  const setRightWidth = useCallback((width: number) => {
    setLayout((current) => ({ ...current, rightWidth: clamp(width, 240, 520) }));
  }, []);

  return { layout, setLeftOpen, setRightOpen, setLeftWidth, setRightWidth };
}
