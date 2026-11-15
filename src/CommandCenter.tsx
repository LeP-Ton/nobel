import type { CSSProperties } from "react";
import {
  Activity,
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
  Gauge,
  Layers3,
  Radio,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { FIELD_META } from "./data";
import { cultureEffects, ranked, score } from "./engine";
import type { FieldId, GameEvent, Project, World } from "./types";
import ScienceCore from "./ScienceCore";
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
  onFieldSelect?: (field: FieldId) => void;
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
  research: "研究执行中",
  bottleneck: "研究瓶颈",
  breakthrough: "突破待转化",
  engineering: "工程验证中",
  production: "规模化生产",
  failed: "验证失败",
  terminated: "已终止",
};
const format = (n: number, digits = 1) =>
  n.toLocaleString("zh-CN", { maximumFractionDigits: digits });
const dateLabel = (date: string) => date.slice(0, 10).replaceAll("-", ".");

export default function CommandCenter({
  world,
  onNavigate,
  onNewProject,
  onBudget,
  onProject,
  onEvent,
  onAdvance,
  onFieldSelect,
}: Props) {
  const country = world.countries.find((c) => c.id === world.player)!;
  const ranking = ranked(world);
  const rank = ranking.findIndex((c) => c.id === world.player) + 1;
  const rival = ranking.find((c) => c.id !== world.player)!;
  const effects = cultureEffects(country);
  const active = world.projects.filter((p) => ACTIVE.has(p.status));
  const breakthroughs = world.projects.filter(
    (p) => p.status === "breakthrough",
  );
  const engineering = world.projects.filter((p) => p.status === "engineering");
  const scientists = world.scientists.filter((s) => s.country === country.id);
  const freeScientists = scientists.filter(
    (s) => !active.some((p) => p.scientists.includes(s.id)),
  );
  const institutions = world.institutions.filter(
    (i) => i.country === country.id,
  );
  const committed = active.reduce((sum, p) => sum + p.funding, 0);
  const applicationBudget = country.budget * (1 - world.policy.basic / 100);
  const events = world.events.filter((e) => !e.historical).slice(0, 4);
  const projectPriority = {
    bottleneck: 0,
    engineering: 1,
    research: 2,
    breakthrough: 3,
    production: 4,
    failed: 5,
    terminated: 6,
  };
  const projects = [...world.projects]
    .sort((a, b) => projectPriority[a.status] - projectPriority[b.status])
    .slice(0, 3);
  const selectField = (field: FieldId) =>
    onFieldSelect ? onFieldSelect(field) : onNavigate("projects");
  const quarter = Math.ceil(Number(world.date.slice(5, 7)) / 3);
  const policy = country.researchCulture;

  return (
    <div className="cc-root hc-root">
      <section className="hc-cockpit" aria-label="国家科研中枢">
        <div className="hc-shell-corner hc-shell-top-left" aria-hidden="true" />
        <div
          className="hc-shell-corner hc-shell-bottom-right"
          aria-hidden="true"
        />
        <header className="hc-bridge-header">
          <div className="hc-bridge-title">
            <span className="hc-section-number">01</span>
            <span className="hc-title-mark">
              <Atom size={20} />
            </span>
            <div>
              <span className="hc-kicker">NATIONAL SCIENCE CORE</span>
              <h2>国家科研中枢</h2>
            </div>
          </div>
          <div className="hc-bridge-status">
            <span className="hc-system-live">
              <i /> 世界引擎在线
            </span>
            <span className="hc-bridge-date">{dateLabel(world.date)}</span>
            <ScanLine size={16} />
          </div>
        </header>
        <div className="hc-system-rail" aria-label="科研网络运行概况">
          <span>
            <ShieldCheck size={12} /> 国家科研网络
          </span>
          <span>
            <b>{world.countries.length}</b> 竞争国家
          </span>
          <span>
            <b>{active.length}</b> 执行计划
          </span>
          <span>
            <b>{institutions.length}</b> 重点机构
          </span>
          <span className="hc-rail-mode">现实世界 / 动态未来</span>
        </div>
        <div className="hc-cockpit-main">
          <aside className="hc-strategy-dock" aria-label="国家战略模块">
            <div className="hc-dock-heading">
              <span>战略模块</span>
              <small>STRATEGY MODULE</small>
            </div>
            <div className="hc-national-signature">
              <span>{country.id}</span>
              <div>
                <strong>{country.name}</strong>
                <small>国家科技战略委员会</small>
              </div>
            </div>
            <div className="hc-doctrine">
              <span className="hc-micro-label">当前科研路径</span>
              <h3>{policy.horizon < 45 ? "工程攻坚" : "自主探索"}</h3>
              <p>
                {policy.horizon < 45
                  ? "短期成果 · 执行优先"
                  : "长期积累 · 原创优先"}
              </p>
            </div>
            <div className="hc-doctrine-gauges">
              {(
                [
                  { key: "autonomy", label: "研究自主性" },
                  { key: "horizon", label: "长期评价" },
                  { key: "execution", label: "工程执行" },
                ] as const
              ).map((axis) => (
                <div
                  key={axis.key}
                  className={
                    axis.key === "execution" ? "hc-gauge-engineering" : ""
                  }
                >
                  <div>
                    <span>{axis.label}</span>
                    <strong>{format(policy[axis.key], 0)}</strong>
                  </div>
                  <div className="hc-segmented-gauge">
                    <i style={{ width: `${policy[axis.key]}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="hc-doctrine-effects">
              <div>
                <Sparkles size={13} />
                <span>创新发挥</span>
                <b>×{format(effects.innovation, 2)}</b>
              </div>
              <div>
                <Gauge size={13} />
                <span>工程转化</span>
                <b>×{format(effects.engineering, 2)}</b>
              </div>
            </div>
            <button
              className="hc-dock-action"
              onClick={() => onNavigate("strategy")}
            >
              调整科研制度 <ArrowUpRight size={14} />
            </button>
            <div className="hc-dock-reserves">
              <span>可用财政储备</span>
              <strong>
                ${format(country.treasury)}
                <small>B</small>
              </strong>
              <div>
                <Users size={12} />
                <span>
                  {freeScientists.length} / {scientists.length} 位首席待命
                </span>
              </div>
            </div>
          </aside>
          <div className="hc-core-stage">
            <ScienceCore world={world} onFieldSelect={selectField} />
          </div>
          <aside className="hc-command-dock" aria-label="指令队列">
            <div className="hc-dock-heading">
              <span>指令队列</span>
              <small>COMMAND QUEUE</small>
            </div>
            <button
              className="hc-command hc-command-resource"
              onClick={onBudget}
            >
              <span className="hc-command-id">01 / RESOURCE</span>
              <div className="hc-command-caption">
                <SlidersHorizontal size={17} />
                <strong>调配科研资源</strong>
                <ChevronRight size={15} />
              </div>
              <p>年度应用研究预算</p>
              <div className="hc-command-value">
                ${format(applicationBudget)}
                <small>B</small>
                <span>已承诺 {format(committed)} B</span>
              </div>
              <div className="hc-command-load">
                <i
                  style={{
                    width: `${Math.min(100, (committed / Math.max(1, applicationBudget)) * 100)}%`,
                  }}
                />
              </div>
            </button>
            <button
              className={`hc-command ${breakthroughs.length ? "hc-command-priority" : ""}`}
              onClick={
                breakthroughs.length
                  ? () => onNavigate("industry")
                  : onNewProject
              }
            >
              <span className="hc-command-id">
                02 / {breakthroughs.length ? "TRANSFER" : "RESEARCH"}
              </span>
              <div className="hc-command-caption">
                {breakthroughs.length ? (
                  <Sparkles size={17} />
                ) : (
                  <FlaskConical size={17} />
                )}
                <strong>
                  {breakthroughs.length ? "转化突破成果" : "部署研究计划"}
                </strong>
                <ChevronRight size={15} />
              </div>
              <div className="hc-command-count">
                <b>
                  {String(
                    breakthroughs.length || freeScientists.length,
                  ).padStart(2, "0")}
                </b>
                <span>
                  {breakthroughs.length
                    ? "项技术等待工程化"
                    : "位重点科学家可配置"}
                </span>
              </div>
              <p>
                {engineering.length
                  ? `${engineering.length} 项工程化验证正在执行`
                  : breakthroughs.length
                    ? "技术突破后仍需工程验证与资金投入"
                    : "配置方向、团队与年度经费"}
              </p>
            </button>
            <button className="hc-advance-command" onClick={onAdvance}>
              <span>
                <Activity size={16} />
                <b>推进科研周期</b>
                <small>模拟推进 30 天</small>
              </span>
              <ArrowRight size={22} />
            </button>
            <div className="hc-command-note">
              <i /> 每月科研结算{" "}
              <span>
                Q{quarter} / {world.date.slice(0, 4)}
              </span>
            </div>
          </aside>
        </div>
        <footer className="hc-rival-track">
          <div className="hc-player-rank">
            <span>综合科技位次</span>
            <b>{String(rank).padStart(2, "0")}</b>
            <small>/ {world.countries.length}</small>
          </div>
          <div className="hc-rival-lanes">
            {ranking.slice(0, 4).map((nation, index) => (
              <button
                key={nation.id}
                className={nation.id === country.id ? "hc-rival-home" : ""}
                onClick={() => onNavigate("ranking")}
              >
                <small>{String(index + 1).padStart(2, "0")}</small>
                <span>{nation.name}</span>
                <b>{format(score(nation))}</b>
                <i style={{ width: `${score(nation)}%` }} />
              </button>
            ))}
          </div>
          <button
            className="hc-rank-action"
            onClick={() => onNavigate("ranking")}
          >
            全球竞争 <ArrowUpRight size={14} />
          </button>
        </footer>
      </section>

      <section className="hc-frontlines" aria-label="五大科技战线">
        <header className="hc-section-header">
          <div>
            <span className="hc-section-number">02</span>
            <h2>五大科技战线</h2>
            <small>RESEARCH DIVISIONS</small>
          </div>
          <button onClick={() => onNavigate("strategy")}>
            技术依赖与预算 <ArrowUpRight size={13} />
          </button>
        </header>
        <div className="hc-division-slots">
          {FIELDS.map((field, index) => {
            const Icon = ICONS[field];
            const difference = country.fields[field] - rival.fields[field];
            const fieldProjects = active.filter((p) => p.field === field);
            return (
              <button
                key={field}
                className="hc-division"
                onClick={() => selectField(field)}
                style={
                  { "--hc-field": FIELD_META[field].color } as CSSProperties
                }
              >
                <span className="hc-division-index">D.0{index + 1}</span>
                <div className="hc-division-heading">
                  <span>
                    <Icon size={22} />
                  </span>
                  <h3>{FIELD_META[field].name}</h3>
                  <ChevronRight size={12} />
                </div>
                <div className="hc-division-measure">
                  <strong>{format(country.fields[field])}</strong>
                  <span
                    className={difference >= 0 ? "hc-positive" : "hc-negative"}
                  >
                    {difference >= 0 ? (
                      <ArrowUpRight size={11} />
                    ) : (
                      <ArrowDownRight size={11} />
                    )}
                    {difference >= 0 ? "+" : ""}
                    {format(difference)}
                  </span>
                </div>
                <div className="hc-division-scale">
                  <i style={{ width: `${country.fields[field]}%` }} />
                  <span
                    style={{ left: `${Math.min(99, rival.fields[field])}%` }}
                    title={`${rival.name} ${format(rival.fields[field])}`}
                  />
                </div>
                <div className="hc-division-funding">
                  <span>年度投入</span>
                  <b>
                    $
                    {format(
                      (country.budget * country.allocations[field]) / 100,
                    )}
                    <small>B</small>
                  </b>
                </div>
                <div className="hc-division-footer">
                  <span>{country.allocations[field]}% 预算</span>
                  <span>
                    <i
                      className={
                        fieldProjects.length ? "hc-division-active" : ""
                      }
                    />
                    {fieldProjects.length
                      ? `${fieldProjects.length} 项执行`
                      : "等待部署"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="hc-model-note">
          <span>
            <i /> 能力与投入来自当前世界状态
          </span>
          <span>竞争差值参照：{rival.name}</span>
        </div>
      </section>

      <div className="hc-operation-deck">
        <section className="hc-research-deck" aria-label="战略科研计划">
          <header className="hc-section-header">
            <div>
              <span className="hc-section-number">03</span>
              <h2>战略科研计划</h2>
              <small>{active.length} 项执行中</small>
            </div>
            <button onClick={() => onNavigate("projects")}>
              全部计划 <ArrowUpRight size={13} />
            </button>
          </header>
          <div className="hc-project-register">
            {projects.length ? (
              projects.map((project, index) => {
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
                    className={`hc-project hc-project-${project.status}`}
                    key={project.id}
                    onClick={() => onProject(project)}
                    style={
                      {
                        "--hc-field": FIELD_META[project.field].color,
                      } as CSSProperties
                    }
                  >
                    <span className="hc-project-index">0{index + 1}</span>
                    <span className="hc-project-emblem">
                      <Icon size={23} />
                    </span>
                    <div className="hc-project-content">
                      <div className="hc-project-title">
                        <h3>{project.name}</h3>
                        <span>{STATUS[project.status]}</span>
                      </div>
                      <div className="hc-project-meta">
                        <span>{FIELD_META[project.field].name}</span>
                        <i />
                        <span>{project.scientists.length} 位首席</span>
                        <i />
                        <span>${format(project.funding)} B / 年</span>
                      </div>
                      <div className="hc-project-progress">
                        <span style={{ width: `${progress}%` }} />
                      </div>
                      <div className="hc-phase-rail">
                        {["科研", "突破", "工程", "投产"].map((label, i) => (
                          <span
                            key={label}
                            className={i <= stage ? "hc-phase-reached" : ""}
                          >
                            {i < stage ? <Check size={8} /> : <i />}
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="hc-project-result">
                      <strong>
                        {format(progress, 0)}
                        <small>%</small>
                      </strong>
                      <ChevronRight size={17} />
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="hc-empty">
                <FlaskConical size={27} />
                <h3>新的科学问题，等待你的指令</h3>
                <p>选择技术方向，配置研究团队与经费。</p>
              </div>
            )}
          </div>
          <button className="hc-new-project" onClick={onNewProject}>
            <FlaskConical size={16} />
            <span>批准新的研究计划</span>
            <ArrowRight size={18} />
          </button>
        </section>
        <section className="hc-intelligence-deck" aria-label="全球科技情报">
          <header className="hc-section-header">
            <div>
              <span className="hc-section-number">04</span>
              <h2>全球科技情报</h2>
            </div>
            <button onClick={() => onNavigate("archive")}>
              <Radio size={13} /> 事件档案
            </button>
          </header>
          <div className="hc-intelligence-terminal">
            <div className="hc-terminal-status">
              <span>
                <i /> 科研情报链路
              </span>
              <small>{events.length} 条最新信息</small>
            </div>
            {events.length ? (
              events.map((event) => (
                <button
                  className={`hc-event hc-event-${event.type}`}
                  key={event.id}
                  onClick={() => onEvent(event)}
                >
                  <span className="hc-event-time">
                    {event.date.slice(5, 10).replace("-", ".")}
                    <i />
                  </span>
                  <div>
                    <div className="hc-event-source">
                      <span>
                        {world.countries.find((c) => c.id === event.country)
                          ?.name || "全球科研网络"}
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
              <div className="hc-empty">
                <Radio size={27} />
                <h3>科研情报链路已就绪</h3>
                <p>推进时间，接收世界科技动态。</p>
              </div>
            )}
            <div className="hc-terminal-foot">
              <span>{world.countries.length} 国同步演进</span>
              <small>未来事件由模拟生成</small>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
