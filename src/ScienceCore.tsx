import { useId, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  Cpu,
  Dna,
  Factory,
  Layers3,
  Network,
  Orbit,
  Zap,
} from "lucide-react";
import { FIELD_META } from "./data";
import { score } from "./engine";
import type { FieldId, World } from "./types";
import LaboratoryScene from "./LaboratoryScene";
import "./science-core.css";

interface Props {
  world: World;
  motion: boolean;
  onFieldSelect: (field: FieldId) => void;
}

const FIELDS: FieldId[] = ["ai", "chips", "energy", "manufacturing", "bio"];
const ICONS = {
  ai: Cpu,
  chips: Layers3,
  energy: Zap,
  manufacturing: Factory,
  bio: Dna,
};
const NODES: Record<FieldId, [number, number]> = {
  ai: [340, 66],
  chips: [567, 195],
  energy: [509, 355],
  manufacturing: [172, 355],
  bio: [112, 195],
};
const ACTIVE = new Set(["research", "bottleneck", "engineering"]);
const number = (value: number, digits = 1) =>
  value.toLocaleString("zh-CN", { maximumFractionDigits: digits });

function connection(from: FieldId, to: FieldId) {
  const [x1, y1] = NODES[from];
  const [x2, y2] = NODES[to];
  return `M${x1} ${y1} Q${340 + (x1 + x2 - 680) * 0.08} ${228 + (y1 + y2 - 456) * 0.08} ${x2} ${y2}`;
}

export default function ScienceCore({ world, motion, onFieldSelect }: Props) {
  const [mode, setMode] = useState<"capability" | "funding">("capability");
  const [focus, setFocus] = useState<FieldId | null>(null);
  const id = useId().replace(/:/g, "");
  const country = world.countries.find((item) => item.id === world.player)!;
  const active = world.projects.filter((project) => ACTIVE.has(project.status));
  const capacity = country.budget * (1 - world.policy.basic / 100);
  const committed = active.reduce(
    (total, project) => total + project.funding,
    0,
  );
  const freeBudget = Math.max(0, capacity - committed);
  const index = score(country);
  const focusedDependencies = focus ? FIELD_META[focus].dependencies : [];
  const edges = FIELDS.flatMap((field) =>
    FIELD_META[field].dependencies.map((dependency) => ({
      from: field,
      to: dependency,
    })),
  );
  const ticks = Array.from({ length: 80 }, (_, i) => {
    const angle = (i * Math.PI) / 40;
    const major = i % 5 === 0;
    return {
      x1: 340 + Math.sin(angle) * 130,
      y1: 230 - Math.cos(angle) * 130,
      x2: 340 + Math.sin(angle) * (major ? 138 : 133),
      y2: 230 - Math.cos(angle) * (major ? 138 : 133),
      major,
    };
  });

  return (
    <section className="sc-core" aria-label="五领域科研协同中枢">
      <div className="sc-telemetry">
        <span>
          <Network size={12} /> 科研协同中枢 <b>SCIENCE NEXUS</b>
        </span>
        <time dateTime={world.date}>{world.date.replaceAll("-", ".")}</time>
      </div>
      <div className="sc-instrument">
        <LaboratoryScene className="sc-scene" variant="core" enabled={motion} />
        <div className="sc-atmosphere" aria-hidden="true" />
        <svg className="sc-network" viewBox="0 0 680 460" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#c4f8fc" />
              <stop offset="1" stopColor="#3e97ae" />
            </linearGradient>
            <linearGradient id={`${id}-gauge`} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#438da7" />
              <stop offset=".5" stopColor="#b0f4f7" />
              <stop offset="1" stopColor="#54b5cb" />
            </linearGradient>
            <marker
              id={`${id}-arrow`}
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="4"
              markerHeight="4"
              orient="auto"
            >
              <path
                d="M1 1L7 4L1 7"
                fill="none"
                stroke="#81d9e6"
                strokeWidth="1"
              />
            </marker>
            <mask id={`${id}-ring-mask`}>
              <rect width="680" height="460" fill="white" />
              <rect
                x="260"
                y="176"
                width="160"
                height="124"
                rx="38"
                fill="black"
              />
            </mask>
          </defs>
          <g className="sc-links">
            {edges.map((edge) => {
              const selected = focus === edge.from || focus === edge.to;
              const strength = Math.min(
                country.fields[edge.from],
                country.fields[edge.to],
              );
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  className={`sc-link ${selected ? "sc-link-active" : ""} ${focus && !selected ? "sc-link-muted" : ""}`}
                  d={connection(edge.from, edge.to)}
                  fill="none"
                  stroke={`url(#${id}-line)`}
                  strokeWidth={selected ? 1.9 : 0.45 + strength / 135}
                  markerEnd={`url(#${id}-arrow)`}
                />
              );
            })}
          </g>
          <g className="sc-scale" mask={`url(#${id}-ring-mask)`}>
            <circle
              cx="340"
              cy="230"
              r="142"
              fill="none"
              stroke="#77c6d7"
              strokeWidth=".5"
              opacity=".3"
            />
            {ticks.map((tick, i) => (
              <line
                key={i}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                stroke={tick.major ? "#96dbe6" : "#628e9d"}
                strokeWidth={tick.major ? "1.1" : ".65"}
                opacity={tick.major ? ".7" : ".42"}
              />
            ))}
            <circle
              className="sc-orbit"
              cx="340"
              cy="230"
              r="119"
              fill="none"
              stroke="#9ee8ef"
              strokeWidth="1"
              strokeDasharray="54 11 8 20 2 190 40 42 16 362"
              opacity=".45"
            />
            <circle
              className="sc-orbit-reverse"
              cx="340"
              cy="230"
              r="111"
              fill="none"
              stroke="#d5b473"
              strokeWidth=".7"
              strokeDasharray="10 42 82 99 4 230 20 168"
              opacity=".55"
            />
          </g>
          <circle
            className="sc-index-track"
            cx="340"
            cy="230"
            r="96"
            fill="none"
            stroke="#376b7b"
            strokeWidth="2"
            opacity=".45"
          />
          <circle
            className="sc-index-gauge"
            cx="340"
            cy="230"
            r="96"
            fill="none"
            stroke={`url(#${id}-gauge)`}
            strokeWidth="2.5"
            pathLength="100"
            strokeDasharray={`${Math.min(100, index)} 100`}
            transform="rotate(-90 340 230)"
          />
          <path
            d="M27 70V27H73M607 27H653V70M27 390V433H73M607 433H653V390"
            stroke="#6cb1c2"
            strokeWidth=".8"
            opacity=".35"
            fill="none"
          />
          <path
            d="M340 101V116M340 344V359M211 230H226M454 230H469"
            stroke="#a3e1e4"
            strokeWidth=".75"
            opacity=".6"
          />
        </svg>
        <div className="sc-center">
          <span className="sc-center-label">{country.name} · 综合科技指数</span>
          <strong>
            {number(index)}
            <small> / 100</small>
          </strong>
          <span className="sc-center-line" />
          <span className="sc-budget-label">应用预算余量</span>
          <b>
            ${number(freeBudget)}
            <small>B / 年</small>
          </b>
          <span className="sc-center-status">
            <i />
            {active.length} 项科研计划执行中
          </span>
        </div>
        <div className="sc-node-list">
          {FIELDS.map((field, index) => {
            const Icon = ICONS[field];
            const budget = (country.budget * country.allocations[field]) / 100;
            const [x, y] = NODES[field];
            const dependent =
              focus !== null && focusedDependencies.includes(field);
            const related =
              focus === field ||
              dependent ||
              (focus !== null &&
                FIELD_META[field].dependencies.includes(focus));
            return (
              <button
                key={field}
                className={`sc-node sc-node-${field}${focus === field ? " sc-node-focused" : ""}${related ? " sc-node-related" : ""}${focus && !related ? " sc-node-dim" : ""}`}
                style={
                  {
                    "--sc-x": `${(x / 680) * 100}%`,
                    "--sc-y-offset": `${((y - 230) / 680) * 100}cqw`,
                  } as CSSProperties
                }
                onPointerEnter={() => setFocus(field)}
                onPointerLeave={() => setFocus(null)}
                onFocus={() => setFocus(field)}
                onBlur={() => setFocus(null)}
                onClick={() => onFieldSelect(field)}
                aria-label={`进入${FIELD_META[field].name}，能力${number(country.fields[field])}，年度投入${number(budget)}十亿美元`}
              >
                <span className="sc-node-top">
                  <Icon size={15} />
                  <b>{FIELD_META[field].name}</b>
                  <ArrowRight size={11} />
                </span>
                <span className="sc-node-value">
                  {mode === "capability"
                    ? number(country.fields[field])
                    : `$${number(budget)}`}
                  <small>{mode === "capability" ? "科技能力" : "B / 年"}</small>
                  <i>0{index + 1}</i>
                </span>
                <span className="sc-node-meter">
                  <i
                    style={{
                      width: `${mode === "capability" ? country.fields[field] : country.allocations[field]}%`,
                    }}
                  />
                </span>
                <span className="sc-node-bottom">
                  {mode === "capability"
                    ? `年度投入 $${number(budget)} B`
                    : `预算权重 ${number(country.allocations[field], 0)}%`}
                  <em>
                    {dependent
                      ? "前置依赖"
                      : `${world.projects.filter((p) => p.field === field && ACTIVE.has(p.status)).length} 项执行中`}
                  </em>
                </span>
              </button>
            );
          })}
        </div>
        <span className="sc-scene-code" aria-hidden="true">
          NOBEL / OPTICAL COLLABORATION ARRAY
        </span>
      </div>
      <div className="sc-display-controls">
        <p>
          <Orbit size={13} />
          {focus ? (
            <>
              <b>{FIELD_META[focus].name}</b>
              <span>
                依赖{" "}
                {focusedDependencies
                  .map((field) => FIELD_META[field].name)
                  .join("、")}
              </span>
            </>
          ) : (
            <>
              <b>技术依赖已联通</b>
              <span>聚焦领域节点查看协同路径</span>
            </>
          )}
        </p>
        <div className="sc-mode-switch" aria-label="科研网络显示模式">
          <button
            className={mode === "capability" ? "sc-mode-active" : ""}
            aria-pressed={mode === "capability"}
            onClick={() => setMode("capability")}
          >
            能力网络
          </button>
          <button
            className={mode === "funding" ? "sc-mode-active" : ""}
            aria-pressed={mode === "funding"}
            onClick={() => setMode("funding")}
          >
            投入网络
          </button>
        </div>
      </div>
    </section>
  );
}
