import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  FlaskConical,
  Gauge,
  Hourglass,
  Landmark,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cultureEffects, updateResearchCulture } from "./engine";
import type { ActionResult, World } from "./types";
import "./research-culture.css";

type CultureKey = "autonomy" | "horizon" | "execution";
type Culture = Record<CultureKey, number>;
type Props = {
  world: World;
  onChange: (result: ActionResult, message: string) => void;
};

const AXES = [
  {
    key: "autonomy",
    name: "研究自主性",
    low: "任务驱动",
    high: "自主探索",
    icon: FlaskConical,
    description: "为研究团队保留自主选题空间，提高前沿探索效率。",
  },
  {
    key: "horizon",
    name: "长期评价权重",
    low: "短期成果",
    high: "长期积累",
    icon: Hourglass,
    description: "降低短周期成果考核的权重，让原创研究获得更长的验证窗口。",
  },
  {
    key: "execution",
    name: "工程组织执行",
    low: "分散组织",
    high: "协同攻坚",
    icon: Gauge,
    description: "集中协调工程资源，提升成熟技术研发与工程化转化效率。",
  },
] as const;

const PRESETS: { name: string; description: string; value: Culture }[] = [
  {
    name: "工程攻坚",
    description: "短期成果 · 组织执行优先",
    value: { autonomy: 32, horizon: 28, execution: 88 },
  },
  {
    name: "均衡发展",
    description: "探索与转化并重",
    value: { autonomy: 60, horizon: 60, execution: 75 },
  },
  {
    name: "探索导向",
    description: "自主选题 · 长期评价优先",
    value: { autonomy: 78, horizon: 76, execution: 65 },
  },
];

const EFFECTS = [
  {
    key: "frontier",
    name: "前沿探索",
    detail: "前沿与未知方向研究效率",
    icon: FlaskConical,
  },
  {
    key: "mature",
    name: "成熟研发",
    detail: "成熟技术项目推进效率",
    icon: Gauge,
  },
  {
    key: "engineering",
    name: "工程转化",
    detail: "科研成果工程化验证效率",
    icon: Landmark,
  },
] as const;

const amount = (value: number) =>
  value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const multiplier = (value: number) => `×${value.toFixed(2)}`;
const sameCulture = (a: Culture, b: Culture) =>
  AXES.every((axis) => a[axis.key] === b[axis.key]);

function direction(culture: Culture) {
  if (culture.autonomy >= 70 && culture.horizon >= 65)
    return {
      title: "自主探索导向",
      text: "为原创问题保留空间，容纳更长的科研回报周期。",
    };
  if (culture.autonomy < 45 || culture.horizon < 40)
    return {
      title: "工程执行优先",
      text: "短期成果考核较强，成熟技术与组织执行优先；原创探索的发挥空间受到限制。",
    };
  return {
    title: "均衡研发体系",
    text: "在自主探索、长期研究与工程转化之间维持平衡。",
  };
}

export default function ResearchCulturePanel({ world, onChange }: Props) {
  const country = world.countries.find((item) => item.id === world.player)!;
  const culture = country.researchCulture;
  const [draft, setDraft] = useState<Culture>({ ...culture });
  useEffect(
    () => setDraft({ ...culture }),
    [country.id, culture.autonomy, culture.horizon, culture.execution],
  );

  const current = cultureEffects(country);
  const preview = cultureEffects({ ...country, researchCulture: draft });
  const changed = !sameCulture(culture, draft);
  const stance = direction(draft);
  // 直接预演引擎操作，保证费用和约束与实际改革一致；失败时不提交任何中间状态。
  const reform = useMemo(() => {
    let next = world;
    for (const axis of AXES) {
      if (
        next.countries.find((item) => item.id === world.player)!
          .researchCulture[axis.key] === draft[axis.key]
      )
        continue;
      const result = updateResearchCulture(next, axis.key, draft[axis.key]);
      if (result.error) return { result, cost: null };
      next = result.world;
    }
    return {
      result: { world: next } as ActionResult,
      cost:
        country.treasury -
        next.countries.find((item) => item.id === world.player)!.treasury,
    };
  }, [world, country.treasury, draft]);

  return (
    <section className="rc-panel" aria-labelledby="rc-title">
      <header className="rc-heading">
        <div>
          <span className="rc-kicker">制度战略 / 01</span>
          <h2 id="rc-title">国家科研体制</h2>
        </div>
        <span className="rc-badge">
          <ShieldCheck size={14} /> 可改革制度情景
        </span>
      </header>
      <div className="rc-presets" aria-label="选择科研体制方案">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            className={
              sameCulture(draft, preset.value)
                ? "rc-preset rc-selected"
                : "rc-preset"
            }
            onClick={() => setDraft({ ...preset.value })}
          >
            <span>
              {preset.name}
              {sameCulture(draft, preset.value) && <Check size={14} />}
            </span>
            <small>{preset.description}</small>
          </button>
        ))}
      </div>
      <div className="rc-body">
        <div className="rc-controls">
          <div className="rc-stance">
            <span className="rc-stance-marker" />
            <div>
              <h3>{stance.title}</h3>
              <p>{stance.text}</p>
            </div>
            {changed && <span className="rc-draft-label">改革预演</span>}
          </div>
          {AXES.map((axis) => (
            <div className="rc-axis" key={axis.key}>
              <label htmlFor={`rc-${axis.key}`}>
                <axis.icon size={17} />
                <strong>{axis.name}</strong>
                <span>
                  {draft[axis.key]}
                  <small> / 100</small>
                </span>
              </label>
              <input
                id={`rc-${axis.key}`}
                type="range"
                min="0"
                max="100"
                step="1"
                value={draft[axis.key]}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    [axis.key]: +event.target.value,
                  }))
                }
              />
              <div className="rc-axis-scale">
                <span>{axis.low}</span>
                <span>{axis.high}</span>
              </div>
              <p>{axis.description}</p>
            </div>
          ))}
        </div>
        <aside className="rc-effects" aria-label="科研体制实际效果">
          <div className="rc-effects-title">
            <span className="rc-kicker">当前制度效果</span>
            <span>{changed ? "现状 → 改革后" : "与中性基准相比"}</span>
          </div>
          {EFFECTS.map((effect) => (
            <div className="rc-effect" key={effect.key}>
              <effect.icon size={19} />
              <div>
                <strong>{effect.name}</strong>
                <small>{effect.detail}</small>
              </div>
              <div className="rc-effect-values">
                <span
                  className={
                    current[effect.key] < 1
                      ? "rc-value rc-negative"
                      : "rc-value"
                  }
                >
                  {multiplier(current[effect.key])}
                </span>
                {changed && (
                  <>
                    <ArrowRight size={12} />
                    <b className={preview[effect.key] < 1 ? "rc-negative" : ""}>
                      {multiplier(preview[effect.key])}
                    </b>
                  </>
                )}
              </div>
            </div>
          ))}
          <div className="rc-principle">
            <Sparkles size={17} />
            <p>
              制度影响项目研究效率；科学家创新能力单独计算。改革可以调整前沿探索、成熟研发与工程化的效率。
            </p>
          </div>
        </aside>
      </div>
      <footer className="rc-footer">
        <div className="rc-finance">
          <span>
            可用财政储备 <b>${amount(country.treasury)} B</b>
          </span>
          <span>
            本次改革支出{" "}
            <strong>
              {reform.cost === null
                ? "方案超出财政能力"
                : `$${amount(Math.max(0, reform.cost))} B`}
            </strong>
          </span>
        </div>
        <div className="rc-actions">
          <button
            className="rc-reset"
            disabled={!changed}
            onClick={() => setDraft({ ...culture })}
          >
            <RotateCcw size={14} /> 撤销预演
          </button>
          <button
            className="rc-commit"
            disabled={!changed || !!reform.result.error}
            onClick={() =>
              onChange(
                reform.result,
                "国家科研体制已调整，后续科研结算将采用新的制度效果",
              )
            }
          >
            <Check size={15} /> 实施改革
          </button>
        </div>
        {reform.result.error && (
          <p className="rc-error" role="status">
            {reform.result.error}
          </p>
        )}
        <p className="rc-footnote">
          制度参数为可调整的游戏情景，非实证统计。每次调整消耗财政资源；恢复原方案也会产生改革支出。
        </p>
      </footer>
    </section>
  );
}
