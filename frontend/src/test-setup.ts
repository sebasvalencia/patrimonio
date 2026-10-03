import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import React from "react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

vi.mock("recharts", () => {
  const call = (props: { label?: unknown; formatter?: unknown; children?: React.ReactNode }) => {
    if (typeof props.label === "function") {
      props.label({});
      props.label({ percent: 0.5 });
    }
    if (typeof props.formatter === "function") props.formatter(10);
    return React.createElement("div", null, props.children);
  };
  const node = (props: { children?: React.ReactNode }) => React.createElement("div", null, props.children);
  return {
    ResponsiveContainer: call,
    PieChart: call,
    Pie: call,
    Tooltip: call,
    LineChart: call,
    BarChart: call,
    Cell: node,
    Line: node,
    Bar: node,
    CartesianGrid: node,
    XAxis: node,
    YAxis: node,
  };
});
