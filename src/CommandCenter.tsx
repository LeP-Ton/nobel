import type { CSSProperties } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Atom,
  Check,
  ChevronRight,
  Cpu,
  Dna,
  Factory,
  FlaskConical,
  Layers3,
  Radio,
  SlidersHorizontal,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { FIELD_META } from "./data";
import { cultureEffects, ranked, score } from "./engine";
import type { Country, FieldId, GameEvent, Project, World } from "./types";
import "./command-center.css";

type Destination =
  | "strategy"
  | "projects"
  | "talent"
  | "institutions"
  | "industry"
  | "ranking"
  | "archive";

interface Props {
  world: World;
  onNavigate: (tab: Destination) => void;
  onNewProject: () => void;
  onBudget: () => void;
  onProject: (project: Project) => void;
  onEvent: (event: GameEvent) => void;
  onAdvance: () => void;
}

const FIELDS: FieldId[] = ["ai", "chips", "energy", "manufacturing", "bio"];
const ICONS = {
  ai: Cpu,
  chips: Layers3,
  energy: Zap,
  manufacturing: Factory,
  bio: Dna,
};
const ACTIVE = new Set(["research", "bottleneck", "engineering"]);
const STATUS: Record<Project["status"], string> = {
  research: "研究中",
  bottleneck: "研究瓶颈",
  breakthrough: "等待转化",
  engineering: "工程验证",
  production: "规模生产",
  failed: "验证失败",
  terminated: "战略终止",
};
const format = (value: number, digits = 1) =>
  value.toLocaleString("zh-CN", { maximumFractionDigits: digits });
const shortDate = (date: string) => date.slice(5, 10).replace("-", ".");
const RADAR_RADIUS = 115;
const points = (radius: number) =>
  FIELDS.map((_, index) => {
    const angle = ((-90 + index * 72) * Math.PI) / 180;
    return [230 + Math.cos(angle) * radius, 155 + Math.sin(angle) * radius];
  });

function CapabilityRadar({
  country,
  rival,
}: {
  country: Country;
  rival: Country;
}) {
  const shape = (nation: Country) =>
    FIELDS.map((field, index) =>
      points((nation.fields[field] / 100) * RADAR_RADIUS)[index].join(","),
    ).join(" ");
  const labelCoordinates = [
    [230, 12],
    [398, 105],
    [340, 284],
    [120, 284],
    [62, 105],
  ];

  return (
    <div className="cc-radar">
      <svg
        viewBox="0 0 460 315"
        role="img"
        aria-label={`${country.name}与${rival.name}的五领域科技能力对比，能力为模拟指数`}
      >
        <defs>
          <radialGradient id="cc-radar-fill">
            <stop offset="0%" stopColor="#88c8ca" stopOpacity=".05" />
            <stop offset="100%" stopColor="#88c8ca" stopOpacity=".23" />
          </radialGradient>
        </defs>
        {[20, 40, 60, 80, 100].map((value) => (
          <polygon
            key={value}
            points={points((value / 100) * RADAR_RADIUS)
              .map((point) => point.join(","))
              .join(" ")}
            fill="none"
            stroke="#41535c"
            strokeWidth={value === 100 ? "1" : ".65"}
            opacity={value === 100 ? ".7" : ".45"}
          />
        ))}
        {points(RADAR_RADIUS).map(([x, y], index) => (
          <line
            key={index}
            x1="230"
            y1="155"
            x2={x}
            y2={y}
            stroke="#40515a"
            strokeWidth=".7"
            opacity=".6"
          />
        ))}
        <polygon
          points={shape(rival)}
          fill="#c4ab7210"
          stroke="#c4ab72"
          strokeDasharray="5 5"
          strokeWidth="1.4"
          opacity=".8"
        />
        <polygon
          points={shape(country)}
          fill="url(#cc-radar-fill)"
          stroke="#9bd2d0"
          strokeWidth="1.7"
        />
        {FIELDS.map((field, index) => {
          const [x, y] = points((country.fields[field] / 100) * RADAR_RADIUS)[
            index
          ];
          const [lx, ly] = labelCoordinates[index];
          return (
            <g key={field}>
              <circle
                cx={x}
                cy={y}
                r="3.3"
                fill="#aedcda"
                stroke="#122027"
                strokeWidth="1.5"
              />
              <text
                x={lx}
                y={ly}
                fill="#afc0c6"
                fontSize="14"
                textAnchor="middle"
              >
                {FIELD_META[field].name}
              </text>
              <text
                x={lx}
                y={ly + 21}
                fill="#d6e5e6"
                fontSize="22"
                fontFamily="Barlow Condensed, sans-serif"
                textAnchor="middle"
              >
                {format(country.fields[field])}
                <tspan fill="#71848e" fontSize="12">
                  {" "}
                  / {format(rival.fields[field])}
                </tspan>
              </text>
            </g>
          );
        })}
        <circle cx="230" cy="155" r="2" fill="#74989d" />
      </svg>
      <div className="cc-radar-key">
        <span>
          <i />
          {country.name}
        </span>
        <span>
          <i />
          {rival.name} · 主要竞争者
        </span>
        <small>模拟能力指数 / 100</small>
      </div>
    </div>
  );
}

export default function CommandCenter({
  world,
  onNavigate,
  onNewProject,
  onBudget,
  onProject,
  onEvent,
  onAdvance,
}: Props) {
  const country = world.countries.find((item) => item.id === world.player)!;
  const ranking = ranked(world);
  const rank = ranking.findIndex((item) => item.id === country.id) + 1;
  const rival = ranking.find((item) => item.id !== country.id)!;
  const culture = country.researchCulture;
  const effects = cultureEffects(country);
  const isShortTerm = culture.horizon < 45;
  const scientists = world.scientists.filter(
    (person) => person.country === country.id,
  );
  const availableScientists = scientists.filter(
    (person) =>
      !world.projects.some(
        (project) =>
          ACTIVE.has(project.status) && project.scientists.includes(person.id),
      ),
  );
  const active = world.projects.filter((project) => ACTIVE.has(project.status));
  const pending = world.projects.filter(
    (project) => project.status === "breakthrough",
  );
  const committed = active.reduce((sum, project) => sum + project.funding, 0);
  const capacity = country.budget * (1 - world.policy.basic / 100);
  const events = world.events.filter((event) => !event.historical).slice(0, 4);
  const sortedProjects = [...world.projects]
    .sort((a, b) => {
      const priority = {
        bottleneck: 0,
        engineering: 1,
        research: 2,
        breakthrough: 3,
        production: 4,
        failed: 5,
        terminated: 6,
      };
      return priority[a.status] - priority[b.status];
    })
    .slice(0, 3);
  const yearProgress = (() => {
    const date = new Date(`${world.date}T00:00:00Z`);
    const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    const end = Date.UTC(date.getUTCFullYear() + 1, 0, 1);
    return ((date.getTime() - start) / (end - start)) * 100;
  })();

  return (
    <div className="cc-root">
      <section className="cc-strategy-board" aria-label="国家科研战略态势">
        <header className="cc-board-header">
          <div>
            <span className="cc-section-index">01</span>
            <h2>国家创新体系</h2>
            <span className="cc-header-meta">国家科研战略态势</span>
          </div>
          <span className="cc-live">
            <i />
            战略网络已连接
          </span>
        </header>
        <div className="cc-board-content">
          <section className="cc-doctrine" aria-label="当前科研制度">
            <div className="cc-doctrine-label">
              <Atom size={15} />
              当前发展路径
            </div>
            <h3>
              {isShortTerm ? "工程驱动" : "探索驱动"}
              <span>{isShortTerm ? "短期成果导向" : "长期创新导向"}</span>
            </h3>
            <p>
              {isShortTerm
                ? "集中组织资源，优先交付可验证的技术成果；前沿探索受到较短考核周期的约束。"
                : "给予科研团队更大的探索空间，以长期积累支撑前沿突破；成果转化仍需持续投入。"}
            </p>
            <div className="cc-culture-bars">
              {(
                [
                  { key: "autonomy", title: "研究自主性" },
                  { key: "horizon", title: "长期考核权重" },
                  { key: "execution", title: "工程组织执行" },
                ] as const
              ).map((item) => (
                <div key={item.key}>
                  <span>{item.title}</span>
                  <div>
                    <i style={{ width: `${culture[item.key]}%` }} />
                  </div>
                  <b>{format(culture[item.key], 0)}</b>
                </div>
              ))}
            </div>
            <div className="cc-policy-effect">
              <span>
                创新发挥 <b>{format(effects.innovation * 100, 0)}%</b>
              </span>
              <span>
                工程效率 <b>×{format(effects.engineering, 2)}</b>
              </span>
            </div>
            <button
              className="cc-text-action"
              onClick={() => onNavigate("strategy")}
            >
              调整科研制度 <ArrowRight size={14} />
            </button>
            <small className="cc-model-label">
              可改革的游戏情景参数，非现实人才评价
            </small>
          </section>
          <section className="cc-capability" aria-label="科技能力结构">
            <div className="cc-capability-heading">
              <span>科技能力结构</span>
              <button onClick={() => onNavigate("ranking")}>
                竞争对比 <ArrowUpRight size={13} />
              </button>
            </div>
            <CapabilityRadar country={country} rival={rival} />
          </section>
          <section className="cc-agenda" aria-label="本期指挥议程">
            <div className="cc-agenda-heading">
              <Target size={16} />
              <h3>本期指挥议程</h3>
              <span>三项决策</span>
            </div>
            <button className="cc-order" onClick={onBudget}>
              <span className="cc-order-number">01</span>
              <div>
                <strong>校准科研资源</strong>
                <p>
                  已承诺 ${format(committed)} B <span>/</span> 应用研究 $
                  {format(capacity)} B
                </p>
              </div>
              <SlidersHorizontal size={15} />
            </button>
            <button
              className={`cc-order ${pending.length ? "cc-order-important" : ""}`}
              onClick={
                pending.length ? () => onNavigate("industry") : onNewProject
              }
            >
              <span className="cc-order-number">02</span>
              <div>
                <strong>
                  {pending.length ? "推动成果转化" : "部署新的研究计划"}
                </strong>
                <p>
                  {pending.length
                    ? `${pending.length} 项突破等待工程化决策`
                    : `${availableScientists.length} 位首席科学家可分配`}
                </p>
              </div>
              {pending.length ? (
                <Sparkles size={15} />
              ) : (
                <FlaskConical size={15} />
              )}
            </button>
            <button className="cc-order" onClick={onAdvance}>
              <span className="cc-order-number">03</span>
              <div>
                <strong>推进科研周期</strong>
                <p>{active.length} 项计划正在执行 · 推进30天</p>
              </div>
              <ArrowRight size={16} />
            </button>
            <div className="cc-year-track">
              <div>
                <span>{world.date.slice(0, 4)} 年度任期</span>
                <strong>
                  Q{Math.ceil(Number(world.date.slice(5, 7)) / 3)}
                </strong>
              </div>
              <div className="cc-year-track-line">
                <span style={{ width: `${yearProgress}%` }} />
                {[0, 25, 50, 75, 100].map((value) => (
                  <i key={value} style={{ left: `${value}%` }} />
                ))}
              </div>
              <small>每月科研结算 · 每年生成科技发展报告</small>
            </div>
          </section>
        </div>
        <div className="cc-standing-strip">
          <span>
            综合科技位次 <b>0{rank}</b>
            <small>/ {ranking.length}</small>
          </span>
          <div className="cc-standing-countries">
            {ranking.slice(0, 4).map((nation, index) => (
              <button
                key={nation.id}
                className={nation.id === country.id ? "cc-standing-home" : ""}
                onClick={() => onNavigate("ranking")}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {nation.name}
                <b>{format(score(nation))}</b>
              </button>
            ))}
          </div>
          <button
            className="cc-text-action"
            onClick={() => onNavigate("ranking")}
          >
            全球竞争 <ArrowRight size={13} />
          </button>
        </div>
      </section>

      <section className="cc-frontlines" aria-label="五大科研战线">
        <div className="cc-section-heading">
          <div>
            <span className="cc-section-index">02</span>
            <h2>五大科研战线</h2>
            <span>能力、投入与竞争差距</span>
          </div>
          <button
            className="cc-text-action"
            onClick={() => onNavigate("strategy")}
          >
            技术依赖与预算 <ArrowRight size={13} />
          </button>
        </div>
        <div className="cc-frontline-grid">
          {FIELDS.map((field) => {
            const Icon = ICONS[field];
            const difference = country.fields[field] - rival.fields[field];
            const count = active.filter(
              (project) => project.field === field,
            ).length;
            return (
              <button
                key={field}
                className="cc-frontline"
                onClick={() => onNavigate("projects")}
                style={
                  { "--cc-field": FIELD_META[field].color } as CSSProperties
                }
              >
                <div className="cc-field-name">
                  <Icon size={20} />
                  <h3>{FIELD_META[field].name}</h3>
                  <ChevronRight size={13} />
                </div>
                <div className="cc-frontline-score">
                  <strong>{format(country.fields[field])}</strong>
                  <span>科研能力</span>
                  <small
                    className={difference >= 0 ? "cc-positive" : "cc-negative"}
                  >
                    {difference >= 0 ? (
                      <ArrowUpRight size={12} />
                    ) : (
                      <ArrowDownRight size={12} />
                    )}
                    {difference >= 0 ? "+" : ""}
                    {format(difference)}
                  </small>
                </div>
                <div className="cc-field-scale">
                  <span style={{ width: `${country.fields[field]}%` }} />
                  <i
                    style={{ left: `${Math.min(99, rival.fields[field])}%` }}
                    title={`${rival.name} ${format(rival.fields[field])}`}
                  />
                </div>
                <div className="cc-field-funding">
                  <span>年度投入</span>
                  <b>
                    $
                    {format(
                      (country.budget * country.allocations[field]) / 100,
                    )}{" "}
                    B
                  </b>
                </div>
                <div className="cc-field-meta">
                  <span>{country.allocations[field]}% 预算</span>
                  <span>{count ? `${count} 项执行中` : "等待研究部署"}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="cc-frontline-note">
          <span>
            <i />
            能力指数及预算均来自当前模拟状态
          </span>
          <span>差值与刻度参照：{rival.name}</span>
        </div>
      </section>

      <div className="cc-operational-grid">
        <section className="cc-projects">
          <div className="cc-section-heading">
            <div>
              <span className="cc-section-index">03</span>
              <h2>战略科研计划</h2>
              <span>{active.length} 项执行中</span>
            </div>
            <button
              className="cc-text-action"
              onClick={() => onNavigate("projects")}
            >
              全部计划 <ArrowRight size={13} />
            </button>
          </div>
          <div className="cc-project-list">
            {sortedProjects.length ? (
              sortedProjects.map((project) => {
                const Icon = ICONS[project.field];
                const stage =
                  project.status === "production"
                    ? 3
                    : project.status === "engineering"
                      ? 2
                      : project.status === "breakthrough"
                        ? 1
                        : 0;
                const progress =
                  project.status === "engineering"
                    ? project.engineeringProgress
                    : project.progress;
                return (
                  <button
                    className={`cc-project cc-project-${project.status}`}
                    key={project.id}
                    onClick={() => onProject(project)}
                    style={
                      {
                        "--cc-field": FIELD_META[project.field].color,
                      } as CSSProperties
                    }
                  >
                    <div className="cc-project-symbol">
                      <Icon size={22} />
                    </div>
                    <div className="cc-project-main">
                      <div className="cc-project-name">
                        <h3>{project.name}</h3>
                        <span>{STATUS[project.status]}</span>
                      </div>
                      <p>
                        {FIELD_META[project.field].name}
                        <i />
                        {project.scientists.length} 位首席科学家
                        <i />${format(project.funding)} B / 年
                      </p>
                      <div className="cc-project-track">
                        <span style={{ width: `${progress}%` }} />
                      </div>
                      <div className="cc-project-stages">
                        {["科研", "突破", "工程", "投产"].map(
                          (label, index) => (
                            <span
                              key={label}
                              className={
                                index <= stage ? "cc-stage-reached" : ""
                              }
                            >
                              {index < stage ? <Check size={9} /> : <i />}
                              {label}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                    <div className="cc-project-percent">
                      <strong>
                        {format(progress, 0)}
                        <small>%</small>
                      </strong>
                      <ChevronRight size={15} />
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="cc-empty">
                <FlaskConical size={26} />
                <h3>下一项科学发现，等待你的部署</h3>
                <p>选择研究方向，配置团队与经费。</p>
              </div>
            )}
          </div>
          <button className="cc-add-project" onClick={onNewProject}>
            <FlaskConical size={16} />
            <span>批准新的研究计划</span>
            <ArrowRight size={15} />
          </button>
        </section>

        <section className="cc-intelligence">
          <div className="cc-section-heading">
            <div>
              <span className="cc-section-index">04</span>
              <h2>全球科技情报</h2>
            </div>
            <button
              className="cc-text-action"
              onClick={() => onNavigate("archive")}
            >
              <Radio size={13} />
              事件档案
            </button>
          </div>
          <div className="cc-intelligence-list">
            {events.length ? (
              events.map((event) => (
                <button
                  className="cc-event"
                  key={event.id}
                  onClick={() => onEvent(event)}
                >
                  <span className="cc-event-date">
                    {shortDate(event.date)}
                    <i />
                  </span>
                  <div>
                    <div className="cc-event-meta">
                      <span>
                        {world.countries.find(
                          (nation) => nation.id === event.country,
                        )?.name || "全球科研网络"}
                      </span>
                      <small>
                        {event.type === "industry"
                          ? "产业进展"
                          : event.type === "talent"
                            ? "人才动态"
                            : event.type === "award"
                              ? "科学荣誉"
                              : event.type === "report"
                                ? "年度报告"
                                : "科研动态"}
                      </small>
                    </div>
                    <h3>{event.title}</h3>
                    <p>{event.description}</p>
                  </div>
                  <ChevronRight size={13} />
                </button>
              ))
            ) : (
              <div className="cc-empty">
                <Radio size={26} />
                <h3>科研情报网络已就绪</h3>
                <p>推进时间，获取世界各地的科技进展。</p>
              </div>
            )}
          </div>
          <div className="cc-intelligence-footer">
            <i />
            {world.countries.length} 个国家同步演进{" "}
            <span>未来事件由模拟生成</span>
          </div>
        </section>
      </div>
    </div>
  );
}
