import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Atom,
  Award,
  Bell,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cpu,
  Dna,
  Factory,
  FileChartColumn,
  FlaskConical,
  Globe2,
  GraduationCap,
  Landmark,
  Layers3,
  Leaf,
  LockKeyhole,
  Menu,
  Microscope,
  Network,
  Pause,
  Play,
  Plus,
  Radio,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import type {
  ActionResult,
  Country,
  FieldId,
  Fields,
  GameEvent,
  Project,
  World,
} from "./types";
import {
  COUNTRIES,
  FIELD_META,
  HISTORICAL_EVENTS,
  SOURCES,
  TECHNOLOGIES,
} from "./data";
import {
  advanceDays,
  assignScientists,
  changeProjectFunding,
  commercialize,
  createWorld,
  investInstitution,
  loadGame,
  ranked,
  saveGame,
  score,
  setPolicy,
  startProject,
  terminateProject,
  updateBudget,
  effectiveInnovation,
} from "./engine";
import CommandCenter from "./CommandCenter";
import ResearchCulturePanel from "./ResearchCulturePanel";

type RankMetric =
  | "composite"
  | "basic"
  | FieldId
  | "industry"
  | "attraction"
  | "influence";
type Tab =
  | "overview"
  | "strategy"
  | "projects"
  | "talent"
  | "institutions"
  | "industry"
  | "ranking"
  | "archive";
type Modal =
  | "budget"
  | "newProject"
  | "save"
  | "settings"
  | "help"
  | "reports"
  | Project
  | GameEvent
  | null;
const FIELDS: FieldId[] = ["ai", "chips", "energy", "manufacturing", "bio"];
const STORE = "nobel-save-v1";
const NAV = [
  { id: "overview", label: "国家概览", en: "COMMAND CENTER", icon: Globe2 },
  { id: "strategy", label: "国家战略", en: "NATIONAL STRATEGY", icon: Target },
  {
    id: "projects",
    label: "科研项目",
    en: "RESEARCH PROJECTS",
    icon: FlaskConical,
  },
  { id: "talent", label: "科研人才", en: "SCIENTIFIC TALENT", icon: Users },
  {
    id: "institutions",
    label: "科研机构",
    en: "INSTITUTIONS",
    icon: Building2,
  },
  { id: "industry", label: "科技产业", en: "TECH INDUSTRY", icon: Factory },
  {
    id: "ranking",
    label: "全球竞争",
    en: "GLOBAL COMPETITION",
    icon: ChartNoAxesCombined,
  },
  { id: "archive", label: "科技档案", en: "SCIENCE ARCHIVE", icon: BookOpen },
] as const;
const STATUS = {
  research: "研究中",
  bottleneck: "遭遇瓶颈",
  breakthrough: "技术突破",
  engineering: "工程化验证",
  production: "规模化生产",
  failed: "研究失败",
  terminated: "已终止",
};
const format = (n: number, digits = 1) =>
  Number(n).toLocaleString("zh-CN", { maximumFractionDigits: digits });
const money = (n: number) => `$${format(n)}`;
const dateLabel = (date: string) => date.slice(0, 10).replaceAll("-", ".");
function FieldIcon({ field, size = 20 }: { field: FieldId; size?: number }) {
  const Icon = {
    ai: Cpu,
    chips: Layers3,
    energy: Zap,
    manufacturing: Factory,
    bio: Dna,
  }[field];
  return <Icon size={size} />;
}
function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <span className="eyebrow">{subtitle}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="progress-track">
      <span
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: color,
        }}
      />
    </div>
  );
}
function Flag({ country }: { country: Pick<Country, "id" | "flag"> }) {
  return (
    <span
      className={`flag flag-${country.id}`}
      role="img"
      aria-label={country.id}
    >
      {country.id === "CN"
        ? "★"
        : country.id === "US"
          ? "✦"
          : country.id === "IN"
            ? "☸"
            : ""}
    </span>
  );
}
function App() {
  const [world, setWorld] = useState<World>(() => createWorld("CN", 2026));
  const [activeSession, setActiveSession] = useState(false);
  const [screen, setScreen] = useState<"menu" | "choose" | "game">("menu");
  const [tab, setTab] = useState<Tab>("overview");
  const [modal, setModal] = useState<Modal>(null);
  const [speed, setSpeed] = useState(0);
  const [selection, setSelection] = useState("CN");
  const [notice, setNotice] = useState("");
  const [countryChoice, setCountryChoice] = useState("CN");
  const [filter, setFilter] = useState<FieldId | "all">("all");
  const [search, setSearch] = useState("");
  const [rankMetric, setRankMetric] = useState<RankMetric>("composite");
  const [saved, setSaved] = useState(() => !!localStorage.getItem(STORE));
  const [autoSave, setAutoSave] = useState(true);
  const [motion, setMotion] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const country = world.countries.find((c) => c.id === world.player)!;
  const chosen = world.countries.find((c) => c.id === selection) || country;
  const ranking = ranked(world);
  const place = ranking.findIndex((c) => c.id === world.player) + 1;
  const active = world.projects.filter(
    (p) => p.status === "research" || p.status === "bottleneck",
  );
  const breakthroughs = world.projects.filter((p) =>
    ["breakthrough", "engineering", "production"].includes(p.status),
  );
  const notify = (msg: string) => setNotice(msg);
  function apply(result: ActionResult, message: string) {
    if (result.error) notify(result.error);
    else {
      setWorld(result.world);
      notify(message);
    }
  }
  function open(value: Modal) {
    setSpeed(0);
    setModal(value);
  }
  function go(value: Tab) {
    setTab(value);
    setSearch("");
    setFilter("all");
    setMobileNav(false);
  }
  function restore(raw: string) {
    try {
      const next = loadGame(raw);
      setWorld(next);
      setActiveSession(true);
      setSelection(next.player);
      setScreen("game");
      setSpeed(0);
      setModal(null);
      notify("存档已载入，世界状态与随机种子已恢复");
    } catch (e) {
      notify(e instanceof Error ? e.message : "存档无法读取");
    }
  }
  useEffect(() => {
    if (!speed || screen !== "game" || modal) return;
    const timer = setInterval(
      () => setWorld((w) => advanceDays(w, speed)),
      800,
    );
    return () => clearInterval(timer);
  }, [speed, screen, modal]);
  useEffect(() => {
    if (screen !== "game" || !autoSave || !activeSession) return;
    try {
      localStorage.setItem(STORE, saveGame(world));
      setSaved(true);
    } catch {
      setNotice("浏览器存储空间不足，请导出存档");
    }
  }, [world, screen, autoSave, activeSession]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen, tab]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setMobileNav(false);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  const advance = (days: number) => {
    setSpeed(0);
    setWorld((w) => advanceDays(w, days));
    notify(`已推进 ${days} 天，科研与全球模拟已结算`);
  };
  const matchingProjects = world.projects.filter(
    (p) => (filter === "all" || p.field === filter) && p.name.includes(search),
  );
  const newGame = () => {
    const next = createWorld(countryChoice, Date.now() % 2147483647);
    setWorld(next);
    setActiveSession(true);
    setSelection(countryChoice);
    setScreen("game");
    go("overview");
    notify("科技战略任期开始 · 2026年1月1日");
  };
  const currentNav = NAV.find((n) => n.id === tab)!;

  function ProjectRow({ project }: { project: Project }) {
    const template = TECHNOLOGIES.find((t) => t.id === project.templateId);
    return (
      <button className="project-row" onClick={() => open(project)}>
        <span
          className="project-icon"
          style={{ color: FIELD_META[project.field].color }}
        >
          <FieldIcon field={project.field} />
        </span>
        <span className="project-info">
          <strong>{project.name}</strong>
          <small>
            {FIELD_META[project.field].name} <i />{" "}
            {template?.type || "科研项目"} <i /> {project.scientists.length}{" "}
            位首席科学家
          </small>
          <Bar
            value={
              project.status === "production"
                ? 100
                : project.status === "engineering"
                  ? project.engineeringProgress
                  : project.progress
            }
            color={FIELD_META[project.field].color}
          />
        </span>
        <span className="project-numbers">
          <span className={`status status-${project.status}`}>
            {STATUS[project.status]}
          </span>
          <strong>
            {format(
              project.status === "engineering"
                ? project.engineeringProgress
                : project.progress,
            )}
            <small>%</small>
          </strong>
        </span>
        <ChevronRight size={16} />
      </button>
    );
  }
  function EventList({ items }: { items: GameEvent[] }) {
    return (
      <div className="event-list">
        {items.length ? (
          items.map((e) => (
            <button key={e.id} className="event" onClick={() => open(e)}>
              <span className={`event-dot event-${e.type}`} />
              <div>
                <small>
                  {dateLabel(e.date)}{" "}
                  <span>
                    {world.countries.find((c) => c.id === e.country)?.name ||
                      "全球"}
                  </span>
                </small>
                <strong>{e.title}</strong>
                <p>{e.description}</p>
              </div>
              <ChevronRight size={14} />
            </button>
          ))
        ) : (
          <div className="empty-state">
            <Radio size={26} />
            <p>全球科研网络已连接</p>
            <small>推进时间，接收来自世界各地的科技动态</small>
          </div>
        )}
      </div>
    );
  }
  function FieldCards() {
    return (
      <div className="field-grid">
        {FIELDS.map((f) => (
          <button
            className="field-card"
            key={f}
            onClick={() => {
              go("projects");
              setFilter(f);
            }}
            style={{ "--field": FIELD_META[f].color } as React.CSSProperties}
          >
            <div className="field-top">
              <FieldIcon field={f} />
              <span>{FIELD_META[f].english}</span>
              <ChevronRight size={13} />
            </div>
            <h3>{FIELD_META[f].name}</h3>
            <div className="field-score">
              <strong>{format(country.fields[f])}</strong>
              <small>科技能力</small>
              <span>
                {country.fields[f] >= 85
                  ? "全球领先"
                  : country.fields[f] >= 70
                    ? "优势领域"
                    : "追赶前沿"}
              </span>
            </div>
            <Bar value={country.fields[f]} color={FIELD_META[f].color} />
            <div className="field-foot">
              <span>年度投入</span>
              <b>{money((country.budget * country.allocations[f]) / 100)} B</b>
            </div>
          </button>
        ))}
      </div>
    );
  }
  function metric(c: Country, key: RankMetric) {
    if (key === "composite") return score(c);
    if (key === "basic") {
      const institutions = world.institutions.filter((i) => i.country === c.id);
      return (
        (FIELDS.reduce((v, f) => v + c.fields[f], 0) / 5) * 0.7 +
        (institutions.length
          ? institutions.reduce((v, i) => v + i.reputation, 0) /
            institutions.length
          : c.influence) *
          0.3
      );
    }
    return key in c.fields
      ? c.fields[key as FieldId]
      : c[key as "industry" | "attraction" | "influence"];
  }
  function RankingList({ compact = false }: { compact?: boolean }) {
    const sorted = compact
      ? ranking
      : [...world.countries].sort(
          (a, b) => metric(b, rankMetric) - metric(a, rankMetric),
        );
    return (
      <div className="ranking-list">
        {sorted.slice(0, compact ? 5 : 8).map((c, index) => (
          <button
            key={c.id}
            className={`rank-row ${c.id === world.player ? "rank-player" : ""}`}
            onClick={() => setSelection(c.id)}
          >
            <span className="rank-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <Flag country={c} />
            <span className="rank-name">
              <strong>{c.name}</strong>
              {c.id === world.player && <small>本国</small>}
            </span>
            <span className="rank-bar">
              <Bar
                value={metric(c, compact ? "composite" : rankMetric)}
                color={c.id === world.player ? "#6fc4cd" : "#718999"}
              />
            </span>
            <strong>
              {format(metric(c, compact ? "composite" : rankMetric))}
            </strong>
            <TrendingUp size={13} />
          </button>
        ))}
      </div>
    );
  }
  const Filters = () => (
    <div className="filter-row">
      <div className="pills">
        <button
          className={filter === "all" ? "selected" : ""}
          onClick={() => setFilter("all")}
        >
          全部领域
        </button>
        {FIELDS.map((f) => (
          <button
            key={f}
            className={filter === f ? "selected" : ""}
            onClick={() => setFilter(f)}
          >
            {FIELD_META[f].name}
          </button>
        ))}
      </div>
      <label className="search">
        <Search size={15} />
        <input
          placeholder="搜索项目"
          aria-label="搜索项目"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
    </div>
  );

  return (
    <div
      className={`${motion ? "" : "reduce-motion"} app`}
      data-page={tab}
      data-screen={screen}
    >
      {screen === "menu" && (
        <div className="main-menu">
          <div className="menu-laboratory" aria-hidden="true" />
          <div className="menu-grain" />
          <header className="menu-header">
            <Brand />
            <span>
              国家科技战略模拟 <span className="small-divider" /> 现实世界 ·
              2026
            </span>
          </header>
          <main className="menu-content">
            <div className="eyebrow gold">
              <span className="live-dot" /> A NEW AGE OF DISCOVERY
            </div>
            <h1>
              NOBEL<span>诺 贝 尔</span>
            </h1>
            <p>
              以科技改变国家
              <br />
              以创新推动人类文明
            </p>
            <div className="menu-actions">
              <button
                className="button primary menu-start"
                onClick={() => setScreen("choose")}
              >
                开始新游戏 <ArrowRight size={19} />
              </button>
              <button
                className="button"
                disabled={!saved}
                onClick={() => restore(localStorage.getItem(STORE) || "")}
              >
                继续游戏 <Play size={16} />
              </button>
              <button
                className="menu-link"
                onClick={() => {
                  setTab("archive");
                  if (saved) restore(localStorage.getItem(STORE) || "");
                  else setScreen("game");
                }}
              >
                世界科技档案 <BookOpen size={16} />
              </button>
              <button className="menu-link" onClick={() => open("settings")}>
                游戏设置 <Settings2 size={16} />
              </button>
            </div>
          </main>
          <div className="menu-coordinate">
            <span>01 / SCIENCE SHAPES THE FUTURE</span>
            <h2>
              下一次突破，
              <br />
              将从你的决策开始。
            </h2>
            <p>八个科技强国 · 五大科研领域 · 无限可能</p>
          </div>
          <footer className="menu-footer">
            <span>
              WORLD ENGINE ONLINE <span className="live-dot" />
            </span>
            <span>
              NOBEL · COMMAND DECK 0.3 <span className="small-divider" />{" "}
              历史基线 · 动态未来
            </span>
          </footer>
        </div>
      )}
      {screen === "choose" && (
        <div className="choose-screen">
          <header>
            <Brand />
            <button className="text-button" onClick={() => setScreen("menu")}>
              <ArrowLeft size={16} /> 返回主菜单
            </button>
          </header>
          <div className="choose-title">
            <span className="eyebrow gold">CHOOSE YOUR NATION</span>
            <h1>选择你的国家</h1>
            <p>
              相同的科学规律，不同的发展道路。你的决策将塑造国家的科技未来。
            </p>
          </div>
          <div className="country-options">
            {COUNTRIES.filter((c) => c.playable).map((c) => (
              <button
                key={c.id}
                className={`country-option ${countryChoice === c.id ? "chosen" : ""}`}
                onClick={() => setCountryChoice(c.id)}
              >
                <div className="country-option-top">
                  <Flag country={c} />
                  <span>
                    {countryChoice === c.id ? <Check size={19} /> : "可选择"}
                  </span>
                </div>
                <span className="eyebrow">{c.english}</span>
                <h2>{c.name}</h2>
                <div className="country-culture-summary">
                  <div>
                    <span>开局科研体制</span>
                    <b>
                      {c.researchCulture.autonomy < 45
                        ? "工程执行优先"
                        : "自主探索导向"}
                    </b>
                    <small>可改革情景</small>
                  </div>
                  <p>
                    {c.researchCulture.autonomy < 45
                      ? "短期成果考核较强，工程攻坚高效；自主探索空间与创新发挥受到限制。"
                      : "自主选题与长期积累优先，为原创问题和前沿研究保留空间。"}
                  </p>
                  <dl>
                    <div>
                      <dt>研究自主性</dt>
                      <dd>{c.researchCulture.autonomy}</dd>
                    </div>
                    <div>
                      <dt>长期评价权重</dt>
                      <dd>{c.researchCulture.horizon}</dd>
                    </div>
                    <div>
                      <dt>工程组织执行</dt>
                      <dd>{c.researchCulture.execution}</dd>
                    </div>
                  </dl>
                </div>
                <div className="country-stats">
                  <div>
                    <small>人口</small>
                    <b>{format(c.population)} 百万</b>
                  </div>
                  <div>
                    <small>GDP</small>
                    <b>{money(c.gdp)} B</b>
                  </div>
                  <div>
                    <small>年度研发投入</small>
                    <b>{money(c.rd)} B</b>
                  </div>
                  <div>
                    <small>科研人员</small>
                    <b>{format(c.researchers)} 千人</b>
                  </div>
                </div>
                <div className="country-strength">
                  <small>科技能力 · 模型初始评分</small>
                  {FIELDS.map((f) => (
                    <div key={f}>
                      <span>{FIELD_META[f].name}</span>
                      <Bar value={c.fields[f]} />
                      <b>{c.fields[f]}</b>
                    </div>
                  ))}
                </div>
                <p>
                  <b>产业优势</b>
                  {c.strengths}
                </p>
                <p>
                  <b>发展挑战</b>
                  {c.challenge}
                </p>
                <small className="muted">
                  统计年份：{c.year} · 详见科技档案来源
                </small>
              </button>
            ))}
          </div>
          <div className="locked-countries">
            {COUNTRIES.filter((c) => !c.playable).map((c) => (
              <div key={c.id}>
                <Flag country={c} />
                <span>
                  {c.name}
                  <small>{c.strengths}</small>
                </span>
                <LockKeyhole size={14} />
                <small>AI 参与 · 后续开放</small>
              </div>
            ))}
          </div>
          <div className="choose-bottom">
            <span>
              <ShieldCheck size={16} /> 真实历史基础 · 未来由模拟生成
            </span>
            <button className="button primary" onClick={newGame}>
              开启科技时代 <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}
      {screen === "game" && (
        <>
          <aside className={`sidebar ${mobileNav ? "visible" : ""}`}>
            <Brand />
            <div className="sidebar-line" />
            <div className="nation-badge">
              <Flag country={country} />
              <div>
                <strong>{country.name}</strong>
                <small>国家科技战略委员会</small>
              </div>
              <ChevronDown size={13} />
            </div>
            <div className="nav-section">战略指挥 / STRATEGY</div>
            <nav>
              {NAV.map((n) => (
                <button
                  key={n.id}
                  className={tab === n.id ? "active" : ""}
                  onClick={() => go(n.id)}
                >
                  <n.icon size={18} />
                  <span>{n.label}</span>
                  {n.id === "projects" && <small>{active.length}</small>}
                  {tab === n.id && <ChevronRight size={13} />}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="world-status">
                <span className="live-dot" /> 世界模拟运行中{" "}
                <small>8 个国家 · 5 大领域</small>
              </div>
              <button onClick={() => open("save")}>
                <Save size={16} /> 存档与读档
              </button>
              <button onClick={() => open("settings")}>
                <Settings2 size={16} /> 游戏设置
              </button>
              <button
                onClick={() => {
                  setScreen("menu");
                  setSpeed(0);
                }}
              >
                <ArrowLeft size={16} /> 返回主菜单
              </button>
              <span className="version">NOBEL 0.3 / 现实世界模式</span>
            </div>
          </aside>
          <div className="workspace">
            <header className="topbar">
              <div className="breadcrumb">
                <button
                  className="mobile-menu"
                  aria-label="打开导航"
                  onClick={() => setMobileNav(!mobileNav)}
                >
                  <Menu size={20} />
                </button>
                <span>NOBEL / 科技战略指挥</span>
                <ChevronRight size={12} />
                <strong>{currentNav.label}</strong>
              </div>
              <div className="topbar-right">
                <span className="world-mode">
                  <Globe2 size={13} /> 现实世界
                </span>
                <button aria-label="游戏说明" onClick={() => open("help")}>
                  <CircleHelp size={17} />
                </button>
                <button
                  className="notification-button"
                  aria-label="查看科技事件"
                  onClick={() => {
                    go("archive");
                    setFilter("all");
                  }}
                >
                  <Bell size={17} />
                  <i />
                </button>
                <span className="avatar">{country.id}</span>
              </div>
            </header>
            <div className="resource-strip">
              <div className="resource">
                <span className="resource-icon gold">
                  <Landmark size={21} />
                </span>
                <div>
                  <small>
                    年度科研预算 <span>USD BILLION</span>
                  </small>
                  <strong>
                    {money(country.budget)}
                    <em>B</em>
                  </strong>
                  <span className="resource-detail">
                    占 GDP {format((country.budget / country.gdp) * 100, 2)}%
                  </span>
                </div>
                <button
                  className="icon-button"
                  aria-label="配置预算"
                  onClick={() => open("budget")}
                >
                  <SlidersHorizontal size={15} />
                </button>
              </div>
              <div className="resource">
                <span className="resource-icon cyan">
                  <Users size={21} />
                </span>
                <div>
                  <small>
                    科研人才 <span>RESEARCHERS</span>
                  </small>
                  <strong>
                    {format(country.researchers)}
                    <em>千人</em>
                  </strong>
                  <span className="resource-detail">
                    {
                      world.scientists.filter((s) => s.country === country.id)
                        .length
                    }{" "}
                    位重点科学家
                  </span>
                </div>
              </div>
              <div className="resource">
                <span className="resource-icon purple">
                  <FlaskConical size={21} />
                </span>
                <div>
                  <small>
                    科研项目 <span>RESEARCH</span>
                  </small>
                  <strong>
                    {active.length}
                    <em>项研究中</em>
                  </strong>
                  <span className="resource-detail">
                    {breakthroughs.length} 项技术已突破
                  </span>
                </div>
              </div>
              <div className="resource">
                <span className="resource-icon green">
                  <Globe2 size={21} />
                </span>
                <div>
                  <small>
                    全球科技排名 <span>WORLD RANK</span>
                  </small>
                  <strong>
                    <em className="rank-hash">#</em>
                    {place}
                    <em>/ {world.countries.length}</em>
                  </strong>
                  <span className="resource-detail">
                    综合实力 {format(score(country))}
                  </span>
                </div>
              </div>
              <div className="time-control">
                <span className="eyebrow">WORLD TIME</span>
                <div className="game-date">
                  {dateLabel(world.date)}
                  <span>{speed ? "运行中" : "已暂停"}</span>
                </div>
                <div className="speed-buttons">
                  <button
                    className={!speed ? "active" : ""}
                    aria-label={speed ? "暂停" : "开始时间"}
                    onClick={() => setSpeed(speed ? 0 : 1)}
                  >
                    {speed ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                  {[1, 2, 5, 10].map((s) => (
                    <button
                      key={s}
                      className={speed === s ? "active" : ""}
                      onClick={() => setSpeed(s)}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <main className="main-content">
              {!activeSession && (
                <div className="info-banner">
                  <BookOpen size={18} />
                  <span>
                    当前为档案预览，尚未开启游戏。已有存档不会被此预览覆盖。
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setScreen("choose")}
                  >
                    开始新游戏 <ArrowRight size={14} />
                  </button>
                </div>
              )}
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {currentNav.en} <span className="tiny-dash" />{" "}
                    {world.date.slice(0, 4)}
                  </div>
                  <h1>
                    {tab === "overview" ? "科技战略指挥舱" : currentNav.label}
                    <span>
                      {tab === "overview"
                        ? "识别关键瓶颈，决定国家的下一次突破。"
                        : {
                            strategy: "把有限的资源，投入最有价值的未来。",
                            projects: "从科学问题出发，向下一个突破前进。",
                            talent: "每一次伟大的发现，都始于一颗好奇的头脑。",
                            institutions: "构筑科学探索的基石。",
                            industry: "从实验室走向世界，让创新产生价值。",
                            ranking: "在全球创新网络中，寻找你的下一步。",
                            archive: "记录发现，见证未来。",
                          }[tab]}
                    </span>
                  </h1>
                </div>
                <div className="heading-actions">
                  <button className="button" onClick={() => open("reports")}>
                    <FileChartColumn size={15} /> 年度报告
                  </button>
                  <button
                    className="button primary"
                    onClick={() =>
                      open(tab === "strategy" ? "budget" : "newProject")
                    }
                  >
                    <Plus size={16} />{" "}
                    {tab === "strategy" ? "配置科研预算" : "创建科研项目"}
                  </button>
                </div>
              </div>

              {tab === "overview" && (
                <CommandCenter
                  world={world}
                  onNavigate={go}
                  onFieldSelect={(field) => {
                    go("projects");
                    setFilter(field);
                  }}
                  onNewProject={() => open("newProject")}
                  onBudget={() => open("budget")}
                  onProject={open}
                  onEvent={open}
                  onAdvance={() => advance(30)}
                />
              )}

              {tab === "strategy" && (
                <>
                  <div className="strategy-intro">
                    <div>
                      <Target size={30} />
                      <h2>国家创新战略</h2>
                      <p>
                        科研预算同时受国家财政、人才储备与产业基础约束。预算为游戏统筹研发资源，含企业研发，非真实政府拨款。基础研究提升长期创新能力，应用研究支持当期项目。
                      </p>
                    </div>
                    <div>
                      <small>可用财政储备</small>
                      <strong>{money(country.treasury)} B</strong>
                      <span>年度科研预算上限：GDP 的 6%</span>
                    </div>
                  </div>
                  <ResearchCulturePanel world={world} onChange={apply} />
                  <FieldCards />
                  <div className="two-columns">
                    <Panel
                      title="科研资源配置"
                      subtitle="RESEARCH ALLOCATION"
                      action={
                        <button
                          className="text-button"
                          onClick={() => open("budget")}
                        >
                          调整预算 <SlidersHorizontal size={14} />
                        </button>
                      }
                    >
                      {FIELDS.map((f) => (
                        <div className="budget-row" key={f}>
                          <span style={{ color: FIELD_META[f].color }}>
                            <FieldIcon field={f} />
                          </span>
                          <div>
                            <strong>{FIELD_META[f].name}</strong>
                            <Bar
                              value={country.allocations[f]}
                              color={FIELD_META[f].color}
                            />
                          </div>
                          <b>{country.allocations[f]}%</b>
                          <span>
                            {money(
                              (country.budget * country.allocations[f]) / 100,
                            )}{" "}
                            B
                          </span>
                        </div>
                      ))}
                    </Panel>
                    <Panel title="科技政策" subtitle="SCIENCE POLICY">
                      <div className="policy-row">
                        <div>
                          <strong>基础研究比例</strong>
                          <p>
                            提高长期创新与未知方向发现概率，减少当期应用项目可用经费。
                          </p>
                        </div>
                        <b>{world.policy.basic}%</b>
                        <input
                          aria-label="基础研究比例"
                          type="range"
                          min="10"
                          max="60"
                          value={world.policy.basic}
                          onChange={(e) =>
                            setWorld((w) =>
                              setPolicy(w, "basic", +e.target.value),
                            )
                          }
                        />
                      </div>
                      {(
                        [
                          {
                            key: "cooperation",
                            title: "开放国际科研合作",
                            text: "增加跨国科研知识交流，提升依赖领域的协作效率。",
                          },
                          {
                            key: "talent",
                            title: "重点人才吸引计划",
                            text: "以科研环境和政策吸引流动人才，需持续投入资源。",
                          },
                        ] as const
                      ).map((p) => (
                        <div className="policy-row" key={p.key}>
                          <div>
                            <strong>{p.title}</strong>
                            <p>{p.text}</p>
                          </div>
                          <button
                            aria-label={p.title}
                            role="switch"
                            aria-checked={world.policy[p.key]}
                            className={`switch ${world.policy[p.key] ? "on" : ""}`}
                            onClick={() =>
                              setWorld((w) =>
                                setPolicy(w, p.key, !w.policy[p.key]),
                              )
                            }
                          >
                            <span />
                          </button>
                        </div>
                      ))}
                    </Panel>
                  </div>
                  <Panel
                    title="技术依赖网络"
                    subtitle="INTERCONNECTED TECHNOLOGY"
                  >
                    <div className="dependency-network">
                      {FIELDS.map((f) => (
                        <div key={f}>
                          <span style={{ color: FIELD_META[f].color }}>
                            <FieldIcon field={f} size={27} />
                          </span>
                          <h3>{FIELD_META[f].name}</h3>
                          <small>依赖领域</small>
                          <p>
                            {FIELD_META[f].dependencies
                              .map((d) => FIELD_META[d].name)
                              .join(" · ") || "基础科学积累"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </>
              )}

              {tab === "projects" && (
                <>
                  <Filters />
                  <div className="project-summary">
                    <span>
                      <i className="cyan-dot" /> {active.length} 项研究进行中
                    </span>
                    <span>
                      <Sparkles size={14} /> {breakthroughs.length} 项技术突破
                    </span>
                    <span>
                      年度项目投入{" "}
                      {money(active.reduce((a, p) => a + p.funding, 0))} B
                    </span>
                    <button className="text-button" onClick={() => advance(30)}>
                      推进一个月 <ArrowRight size={14} />
                    </button>
                  </div>
                  <Panel title="国家科研项目" subtitle="RESEARCH PORTFOLIO">
                    <div className="project-list large-list">
                      {matchingProjects.length ? (
                        matchingProjects.map((p) => (
                          <ProjectRow key={p.id} project={p} />
                        ))
                      ) : (
                        <div className="empty-state">
                          <FlaskConical />
                          <p>当前没有符合条件的科研项目</p>
                          <button
                            className="button"
                            onClick={() => open("newProject")}
                          >
                            创建科研项目
                          </button>
                        </div>
                      )}
                    </div>
                  </Panel>
                  <p className="model-note">
                    科研进展综合考虑经费、人才、技术依赖、机构与创新随机性。预计周期是模型参考，不是固定倒计时。
                  </p>
                </>
              )}

              {tab === "talent" && (
                <>
                  <div className="info-banner">
                    <GraduationCap size={20} />
                    <span>
                      重点科学家为虚构人物。创新潜力属于个人，当前创新发挥受科研制度影响；普通科研人员由国家人才池聚合管理。
                    </span>
                    <button
                      className="text-button"
                      onClick={() => go("strategy")}
                    >
                      调整人才政策 <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="talent-grid">
                    {world.scientists
                      .filter((s) => s.country === country.id)
                      .map((s, i) => {
                        const project = world.projects.find(
                          (p) =>
                            p.scientists.includes(s.id) &&
                            ["research", "bottleneck", "engineering"].includes(
                              p.status,
                            ),
                        );
                        return (
                          <section className="panel scientist-card" key={s.id}>
                            <div className="scientist-heading">
                              <div
                                className={`scientist-avatar avatar-${i % 4}`}
                              >
                                {s.name.slice(0, 1)}
                                <Atom size={45} />
                              </div>
                              <div>
                                <span className="eyebrow">
                                  SIMULATED SCIENTIST
                                </span>
                                <h2>{s.name}</h2>
                                <span
                                  className="field-tag"
                                  style={{ color: FIELD_META[s.field].color }}
                                >
                                  <FieldIcon field={s.field} size={12} />{" "}
                                  {FIELD_META[s.field].name}
                                </span>
                              </div>
                            </div>
                            <p>{s.description}</p>
                            <div className="scientist-metrics">
                              {[
                                { n: "科研能力", v: s.ability },
                                { n: "创新潜力", v: s.innovation },
                                { n: "学术声望", v: s.reputation },
                                { n: "管理能力", v: s.management },
                                {
                                  n: "当前创新发挥",
                                  v: effectiveInnovation(s, country),
                                },
                              ].map((m) => (
                                <div key={m.n}>
                                  <span>{m.n}</span>
                                  <b>{format(m.v)}</b>
                                  <Bar value={m.v} />
                                </div>
                              ))}
                            </div>
                            <div className="scientist-assignment">
                              <Building2 size={14} />
                              <span>
                                {world.institutions.find(
                                  (x) => x.id === s.institution,
                                )?.name || s.institution}
                              </span>
                            </div>
                            <div className="assignment-status">
                              <span
                                className={`live-dot ${project ? "" : "gold-dot"}`}
                              />
                              {project
                                ? `参与：${project.name}`
                                : "可分配至新科研项目"}
                            </div>
                          </section>
                        );
                      })}
                  </div>
                </>
              )}

              {tab === "institutions" && (
                <>
                  <div className="info-banner">
                    <Building2 size={20} />
                    <span>
                      真实机构名称用于世界基线；设备、声望和科研人员规模为游戏模型参数。每次扩建消耗财政储备。
                    </span>
                  </div>
                  <div className="institution-grid">
                    {world.institutions
                      .filter((i) => i.country === country.id)
                      .map((i) => (
                        <section className="panel institution-card" key={i.id}>
                          <div className="institution-heading">
                            <span className="institution-icon">
                              <Landmark size={29} />
                            </span>
                            <span className="badge">{i.type}</span>
                          </div>
                          <span className="eyebrow">
                            {FIELD_META[i.field].english}
                          </span>
                          <h2>{i.name}</h2>
                          <p>{i.description}</p>
                          <div className="institution-stats">
                            <div>
                              <small>设备等级</small>
                              <strong>Lv.{format(i.level)}</strong>
                            </div>
                            <div>
                              <small>学术声望</small>
                              <strong>{format(i.reputation)}</strong>
                            </div>
                            <div>
                              <small>研究人员</small>
                              <strong>{format(i.researchers)}</strong>
                            </div>
                          </div>
                          <button
                            className="button full-width"
                            onClick={() =>
                              apply(
                                investInstitution(world, i.id),
                                `${i.name}扩建完成`,
                              )
                            }
                          >
                            <Plus size={15} /> 投资扩建 ·{" "}
                            {money(2 + i.level * 0.8)} B
                          </button>
                        </section>
                      ))}
                  </div>
                </>
              )}

              {tab === "industry" && (
                <>
                  <div className="industry-pipeline">
                    {["科研突破", "工程化验证", "产业化", "规模化应用"].map(
                      (s, i) => (
                        <div key={s}>
                          <span>{String(i + 1).padStart(2, "0")}</span>
                          <strong>{s}</strong>
                          {i < 3 && <ArrowRight size={21} />}
                        </div>
                      ),
                    )}
                  </div>
                  <div className="industry-stats">
                    <div>
                      <small>已突破技术</small>
                      <strong>
                        {breakthroughs.length}
                        <span>项</span>
                      </strong>
                    </div>
                    <div>
                      <small>工程化中</small>
                      <strong>
                        {
                          world.projects.filter(
                            (p) => p.status === "engineering",
                          ).length
                        }
                        <span>项</span>
                      </strong>
                    </div>
                    <div>
                      <small>已投产技术</small>
                      <strong>
                        {
                          world.projects.filter(
                            (p) => p.status === "production",
                          ).length
                        }
                        <span>项</span>
                      </strong>
                    </div>
                    <div>
                      <small>累计产业收益</small>
                      <strong>
                        {money(country.industryRevenue)}
                        <span>B</span>
                      </strong>
                    </div>
                  </div>
                  <Panel
                    title="技术成果转化"
                    subtitle="FROM DISCOVERY TO IMPACT"
                  >
                    {breakthroughs.length ? (
                      breakthroughs.map((p) => (
                        <ProjectRow key={p.id} project={p} />
                      ))
                    ) : (
                      <div className="empty-state">
                        <Factory size={32} />
                        <h3>让实验室的发现，成为产业的未来</h3>
                        <p>
                          先完成科研突破，再投资工程化验证。技术原创与商业收益分别计算。
                        </p>
                        <button
                          className="button primary"
                          onClick={() => go("projects")}
                        >
                          前往科研项目 <ArrowRight size={15} />
                        </button>
                      </div>
                    )}
                  </Panel>
                </>
              )}

              {tab === "ranking" && (
                <>
                  <div className="two-columns ranking-detail">
                    <Panel
                      title="全球科技实力排名"
                      subtitle="GLOBAL TECHNOLOGY INDEX"
                      action={
                        <select
                          className="ranking-select"
                          aria-label="排行榜指标"
                          value={rankMetric}
                          onChange={(e) =>
                            setRankMetric(e.target.value as RankMetric)
                          }
                        >
                          <option value="composite">综合科技实力</option>
                          <option value="basic">基础科研实力</option>
                          {FIELDS.map((f) => (
                            <option key={f} value={f}>
                              {FIELD_META[f].name}实力
                            </option>
                          ))}
                          <option value="industry">科技产业化能力</option>
                          <option value="attraction">科研人才吸引力</option>
                          <option value="influence">国际科技影响力</option>
                        </select>
                      }
                    >
                      <RankingList />
                      <p className="model-note">
                        综合指数由五领域科研能力、产业化能力、人才吸引力和国际影响力共同计算。基础科研指数按五领域平均能力（70%）与机构声望（30%）计算，均为模型指标。
                      </p>
                    </Panel>
                    <Panel
                      title={`${chosen.name} · 科技档案`}
                      subtitle="NATIONAL SCIENCE PROFILE"
                    >
                      <div className="selected-country">
                        <Flag country={chosen} />
                        <div>
                          <h2>{chosen.name}</h2>
                          <span>
                            {chosen.id === world.player
                              ? "玩家国家"
                              : "AI 自主运营"}{" "}
                            ·{" "}
                            {chosen.id === world.player
                              ? world.projects.length
                              : chosen.aiProjects}{" "}
                            项
                            {chosen.id === world.player
                              ? "国家科研项目"
                              : "AI 科研成果"}
                          </span>
                        </div>
                        <strong>
                          {format(score(chosen))}
                          <small>综合科技指数</small>
                        </strong>
                      </div>
                      {FIELDS.map((f) => (
                        <div className="compare-row" key={f}>
                          <span>{FIELD_META[f].name}</span>
                          <Bar
                            value={chosen.fields[f]}
                            color={FIELD_META[f].color}
                          />
                          <b>{format(chosen.fields[f])}</b>
                        </div>
                      ))}
                      <div className="country-profile-stats">
                        <span>
                          年度预算 <b>{money(chosen.budget)} B</b>
                        </span>
                        <span>
                          产业化能力 <b>{format(chosen.industry)}</b>
                        </span>
                        <span>
                          人才吸引力 <b>{format(chosen.attraction)}</b>
                        </span>
                        <span>
                          国际科技影响力 <b>{format(chosen.influence)}</b>
                        </span>
                      </div>
                    </Panel>
                  </div>
                  <Panel title="科技竞争轨迹" subtitle="EVOLVING WORLD">
                    <TrendChart world={world} />
                    <p className="model-note">
                      季度记录综合指数。推进时间后可观察各国真实模拟轨迹。
                    </p>
                  </Panel>
                </>
              )}

              {tab === "archive" && (
                <>
                  <div className="archive-tabs">
                    <button
                      className={filter === "all" ? "selected" : ""}
                      onClick={() => setFilter("all")}
                    >
                      世界动态
                    </button>
                    <button
                      className={filter === "ai" ? "selected" : ""}
                      onClick={() => setFilter("ai")}
                    >
                      历史科技档案
                    </button>
                    <button
                      className={filter === "bio" ? "selected" : ""}
                      onClick={() => setFilter("bio")}
                    >
                      数据来源与模型
                    </button>
                  </div>
                  {filter === "all" ? (
                    <Panel
                      title="全球科技事件日志"
                      subtitle="DYNAMIC SCIENCE TIMELINE"
                    >
                      <EventList
                        items={world.events.filter((e) => !e.historical)}
                      />
                    </Panel>
                  ) : filter === "ai" ? (
                    <Panel
                      title="真实科技历史"
                      subtitle="VERIFIED HISTORICAL ARCHIVE"
                    >
                      <div className="info-banner compact">
                        <ShieldCheck size={17} />{" "}
                        2026年开局前的真实事件，日期与贡献可通过原始来源核实。
                      </div>
                      <EventList items={HISTORICAL_EVENTS.slice().reverse()} />
                    </Panel>
                  ) : (
                    <Panel
                      title="数据来源与模型说明"
                      subtitle="DATA PROVENANCE"
                    >
                      <div className="source-intro">
                        <h3>历史有据，未来开放</h3>
                        <p>
                          人口、GDP、研发投入采用开局前已发布统计。各统计年份与汇率口径不同，不应解读为2026年精确实测。科技评分、人才能力、机构等级与未来事件为游戏模型。
                        </p>
                        <p>
                          金额统一为十亿美元（B）；人口为百万人；科研人员为千人。八国为首版模拟范围，奖项不直接等同于国家科技实力。
                        </p>
                        <p>
                          科研制度是可改革的游戏情景。研究自主性、长期评价权重和工程组织执行共同影响创新发挥、前沿探索与工程化；所有国家使用相同规则，个人创新潜力独立保存。
                        </p>
                      </div>
                      <div className="source-list">
                        {SOURCES.map((s) => (
                          <a
                            key={s.id}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ShieldCheck size={18} />
                            <div>
                              <h3>{s.title}</h3>
                              <p>{s.note}</p>
                            </div>
                            <ArrowRight size={15} />
                          </a>
                        ))}
                      </div>
                    </Panel>
                  )}
                </>
              )}

              <footer className="game-footer">
                <span>
                  <span className="live-dot" /> NOBEL WORLD ENGINE <i />{" "}
                  历史基线 · 模拟未来
                </span>
                <span>
                  {autoSave ? "进度自动保存" : "自动保存已关闭"}{" "}
                  <ShieldCheck size={12} />
                  <button onClick={() => open("help")}>
                    指挥官指南 <ArrowRight size={12} />
                  </button>
                </span>
              </footer>
            </main>
          </div>
        </>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            className={`modal ${modal === "newProject" || modal === "reports" ? "wide-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              typeof modal === "string"
                ? {
                    budget: "科研预算配置",
                    newProject: "创建科研项目",
                    save: "存档与读档",
                    settings: "游戏设置",
                    help: "指挥官指南",
                    reports: "年度科技报告",
                  }[modal]
                : "name" in modal
                  ? modal.name
                  : modal.title
            }
          >
            <button
              className="modal-close"
              aria-label="关闭窗口"
              onClick={() => setModal(null)}
            >
              <X size={19} />
            </button>
            {modal === "budget" && (
              <BudgetModal
                world={world}
                onSubmit={(budget, allocations) => {
                  const result = updateBudget(world, budget, allocations);
                  apply(result, "国家科研预算已更新");
                  if (!result.error) setModal(null);
                }}
              />
            )}
            {modal === "newProject" && (
              <NewProject
                world={world}
                onSubmit={(id, funding, ids) => {
                  const result = startProject(world, id, funding, ids);
                  apply(result, "科研项目已立项，推进时间开始研究");
                  if (!result.error) setModal(null);
                }}
              />
            )}
            {typeof modal === "object" && modal && "templateId" in modal && (
              <ProjectModal
                project={world.projects.find((p) => p.id === modal.id) || modal}
                world={world}
                onFunding={(id, value) =>
                  apply(
                    changeProjectFunding(world, id, value),
                    "项目年度经费已更新",
                  )
                }
                onAssign={(id, ids) =>
                  apply(assignScientists(world, id, ids), "重点人才配置已更新")
                }
                onCommercialize={(id) => {
                  const result = commercialize(world, id);
                  apply(result, "工程化验证已启动");
                  if (!result.error) setModal(null);
                }}
                onTerminate={(id) => {
                  setWorld(terminateProject(world, id));
                  setModal(null);
                  notify("科研项目已终止，人才与经费已释放");
                }}
              />
            )}
            {typeof modal === "object" && modal && "title" in modal && (
              <>
                <span className="eyebrow">
                  {modal.historical
                    ? "HISTORICAL RECORD"
                    : "SIMULATED WORLD EVENT"}
                </span>
                <h2>{modal.title}</h2>
                <span className="badge">
                  {dateLabel(modal.date)} ·{" "}
                  {modal.historical ? "真实历史" : "未来模拟"}
                </span>
                <p className="event-detail">{modal.description}</p>
                {modal.sourceId &&
                  SOURCES.find((s) => s.id === modal.sourceId) && (
                    <a
                      className="button"
                      href={SOURCES.find((s) => s.id === modal.sourceId)!.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      查看原始来源 <ArrowRight size={15} />
                    </a>
                  )}
              </>
            )}
            {modal === "reports" && (
              <>
                <span className="eyebrow gold">ANNUAL SCIENCE REPORT</span>
                <h2>年度科技发展报告</h2>
                {world.reports.length ? (
                  world.reports.map((r) => (
                    <div
                      className="annual-report"
                      key={`${r.year}-${r.country}`}
                    >
                      <div className="report-year">
                        {r.year}
                        <Award size={35} />
                      </div>
                      <h3>{r.summary}</h3>
                      <div className="country-stats">
                        <div>
                          <small>世界排名</small>
                          <b>#{r.rank}</b>
                        </div>
                        <div>
                          <small>综合实力</small>
                          <b>{format(r.score)}</b>
                        </div>
                        <div>
                          <small>技术突破</small>
                          <b>{r.breakthroughs} 项</b>
                        </div>
                        <div>
                          <small>产业收益</small>
                          <b>{money(r.revenue)} B</b>
                        </div>
                      </div>
                      <p>
                        科研投入 {money(r.spent)} B · 年度新增专利{" "}
                        {format(r.patents)} 项
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <FileChartColumn size={40} />
                    <h3>你的科技时代，才刚刚开始</h3>
                    <p>
                      每年结束时，世界引擎会结算科研成果、产业收益与科技排名。
                    </p>
                    <button
                      className="button primary"
                      onClick={() => {
                        setModal(null);
                        advance(365);
                      }}
                    >
                      模拟推进一年 <ArrowRight size={16} />
                    </button>
                    <small>将真实运行365天模拟，不保证科研成功。</small>
                  </div>
                )}
              </>
            )}
            {modal === "save" && (
              <>
                <span className="eyebrow">SAVE YOUR PROGRESS</span>
                <h2>存档与读档</h2>
                <p className="muted">
                  本机存档保存在当前浏览器。导出文件可迁移到其他设备。
                </p>
                <div className="save-card">
                  <Save size={28} />
                  <div>
                    <strong>
                      {country.name} · {dateLabel(world.date)}
                    </strong>
                    <small>
                      {world.projects.length} 项科研项目 · 世界排名 #{place}
                    </small>
                  </div>
                  <ShieldCheck size={20} />
                </div>
                <div className="modal-action-grid">
                  <button
                    className="button primary"
                    onClick={() => {
                      try {
                        localStorage.setItem(STORE, saveGame(world));
                        setSaved(true);
                        notify("进度已保存到本机");
                      } catch {
                        notify("无法保存，请导出存档");
                      }
                    }}
                  >
                    <Save size={16} /> 保存到本机
                  </button>
                  <button
                    className="button"
                    disabled={!saved}
                    onClick={() => restore(localStorage.getItem(STORE) || "")}
                  >
                    <Play size={16} /> 读取本机存档
                  </button>
                  <button
                    className="button"
                    onClick={() => {
                      const a = document.createElement("a");
                      const url = URL.createObjectURL(
                        new Blob([saveGame(world)], {
                          type: "application/json",
                        }),
                      );
                      a.href = url;
                      a.download = `NOBEL-${country.id}-${world.date.slice(0, 10)}.json`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                      notify("存档文件已导出");
                    }}
                  >
                    <ArrowDownToLine size={16} /> 导出存档文件
                  </button>
                  <button
                    className="button"
                    onClick={() => importInput.current?.click()}
                  >
                    <Upload size={16} /> 导入存档文件
                  </button>
                </div>
                <input
                  ref={importInput}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10_000_000)
                        notify("存档文件不能超过10MB");
                      else restore(await file.text());
                    }
                    e.target.value = "";
                  }}
                />
              </>
            )}
            {modal === "settings" && (
              <>
                <span className="eyebrow">GAME SETTINGS</span>
                <h2>游戏设置</h2>
                <div className="policy-row">
                  <div>
                    <strong>自动保存进度</strong>
                    <p>每次世界状态变化时保存到当前浏览器。</p>
                  </div>
                  <button
                    className={`switch ${autoSave ? "on" : ""}`}
                    role="switch"
                    aria-checked={autoSave}
                    aria-label="自动保存进度"
                    onClick={() => setAutoSave(!autoSave)}
                  >
                    <span />
                  </button>
                </div>
                <div className="policy-row">
                  <div>
                    <strong>界面动态效果</strong>
                    <p>控制科研图形动态与界面过渡。</p>
                  </div>
                  <button
                    className={`switch ${motion ? "on" : ""}`}
                    role="switch"
                    aria-checked={motion}
                    aria-label="界面动态效果"
                    onClick={() => setMotion(!motion)}
                  >
                    <span />
                  </button>
                </div>
                <div className="setting-note">
                  <Globe2 size={20} />
                  <p>
                    现实世界模式 · 2026年开局
                    <br />
                    <small>虚拟世界编辑器计划在后续版本开放。</small>
                  </p>
                </div>
              </>
            )}
            {modal === "help" && (
              <>
                <span className="eyebrow gold">COMMANDER'S GUIDE</span>
                <h2>以科学，塑造未来</h2>
                <ol className="guide">
                  <li>
                    <b>配置国家预算</b>
                    <p>在国家战略中分配五领域年度资金，保留基础研究投入。</p>
                  </li>
                  <li>
                    <b>创建科研项目</b>
                    <p>
                      选择技术方向、年度经费及重点科学家，检查前置技术与人才要求。
                    </p>
                  </li>
                  <li>
                    <b>推进世界时间</b>
                    <p>
                      每日更新世界状态，每月结算科研。其他国家同时自主发展。
                    </p>
                  </li>
                  <li>
                    <b>让突破走向产业</b>
                    <p>在项目详情中投资工程化，验证完成后进入规模化生产。</p>
                  </li>
                  <li>
                    <b>复盘与保存</b>
                    <p>
                      查看年度报告和世界排名。开启自动存档，或导出进度文件。
                    </p>
                  </li>
                </ol>
                <div className="info-banner compact">
                  科技评分、重点科学家与未来事件均为游戏模拟。历史统计的来源见科技档案。
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Activity size={17} />
          {notice}
          <button aria-label="关闭提示" onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-emblem">
        <Atom size={29} strokeWidth={1.2} />
      </span>
      <div>
        <strong>NOBEL</strong>
        <span>诺 贝 尔</span>
      </div>
    </div>
  );
}
function BudgetModal({
  world,
  onSubmit,
}: {
  world: World;
  onSubmit: (budget: number, allocations: Fields) => void;
}) {
  const country = world.countries.find((c) => c.id === world.player)!;
  const [budget, setBudget] = useState(country.budget);
  const [allocations, setAllocations] = useState({ ...country.allocations });
  const sum = FIELDS.reduce((a, f) => a + allocations[f], 0);
  return (
    <>
      <span className="eyebrow gold">NATIONAL RESEARCH BUDGET</span>
      <h2>科研预算配置</h2>
      <p className="muted">
        年度预算单位：十亿美元。各领域分配合计必须为100%。
      </p>
      <label className="input-label">
        国家年度科研预算{" "}
        <span>GDP 的 {format((budget / country.gdp) * 100, 2)}%</span>
        <div className="number-input">
          <span>$</span>
          <input
            type="number"
            aria-label="国家年度科研预算"
            min="1"
            max={country.gdp * 0.06}
            value={budget}
            onChange={(e) => setBudget(+e.target.value)}
          />
          <b>B / 年</b>
        </div>
      </label>
      <div className="allocation-bar">
        {FIELDS.map((f) => (
          <span
            key={f}
            style={{
              width: `${(allocations[f] / Math.max(sum, 1)) * 100}%`,
              background: FIELD_META[f].color,
            }}
          />
        ))}
      </div>
      {FIELDS.map((f) => (
        <div className="allocation-row" key={f}>
          <span style={{ color: FIELD_META[f].color }}>
            <FieldIcon field={f} size={19} />
          </span>
          <strong>{FIELD_META[f].name}</strong>
          <input
            type="range"
            aria-label={`${FIELD_META[f].name}预算比例`}
            min="0"
            max="100"
            value={allocations[f]}
            onChange={(e) =>
              setAllocations((a) => ({ ...a, [f]: +e.target.value }))
            }
          />
          <input
            type="number"
            aria-label={`${FIELD_META[f].name}百分比`}
            min="0"
            max="100"
            value={allocations[f]}
            onChange={(e) =>
              setAllocations((a) => ({ ...a, [f]: +e.target.value }))
            }
          />
          <span>%</span>
        </div>
      ))}
      <div className={`allocation-total ${sum !== 100 ? "warning" : ""}`}>
        分配合计 <strong>{sum}%</strong>
        <button
          className="text-button"
          onClick={() =>
            setAllocations({
              ai: 20,
              chips: 20,
              energy: 20,
              manufacturing: 20,
              bio: 20,
            })
          }
        >
          均衡分配
        </button>
      </div>
      <div className="info-banner compact">
        基础研究占 {world.policy.basic}
        %，其余预算可用于领域项目；已启动项目也占用领域经费。
      </div>
      <button
        className="button primary full-width"
        disabled={sum !== 100 || budget <= 0}
        onClick={() => onSubmit(budget, allocations)}
      >
        确认国家预算 <Check size={16} />
      </button>
    </>
  );
}
function NewProject({
  world,
  onSubmit,
}: {
  world: World;
  onSubmit: (id: string, funding: number, ids: string[]) => void;
}) {
  const [chosen, setChosen] = useState(TECHNOLOGIES[0].id);
  const template = TECHNOLOGIES.find((t) => t.id === chosen)!;
  const [funding, setFunding] = useState(template.funding);
  const [ids, setIds] = useState<string[]>([]);
  const country = world.countries.find((c) => c.id === world.player)!;
  const scientists = world.scientists.filter((s) => s.country === world.player);
  const available = (s: string) =>
    scientists.find((person) => person.id === s)?.field === template.field &&
    !world.projects.some(
      (p) =>
        p.scientists.includes(s) &&
        ["research", "bottleneck", "engineering"].includes(p.status),
    );
  const left =
    ((country.budget * country.allocations[template.field]) / 100) *
      (1 - world.policy.basic / 100) -
    world.projects
      .filter(
        (p) =>
          p.field === template.field &&
          ["research", "bottleneck", "engineering"].includes(p.status),
      )
      .reduce((a, p) => a + p.funding, 0);
  return (
    <>
      <span className="eyebrow gold">START A NEW DISCOVERY</span>
      <h2>创建科研项目</h2>
      <div className="new-project-grid">
        <div className="template-list">
          {TECHNOLOGIES.map((t) => (
            <button
              className={t.id === chosen ? "selected" : ""}
              key={t.id}
              onClick={() => {
                setChosen(t.id);
                setFunding(t.funding);
                setIds([]);
              }}
            >
              <span style={{ color: FIELD_META[t.field].color }}>
                <FieldIcon field={t.field} size={18} />
              </span>
              <div>
                <strong>{t.name}</strong>
                <small>
                  {FIELD_META[t.field].name} · {t.type}
                </small>
              </div>
              {chosen === t.id && <Check size={14} />}
            </button>
          ))}
        </div>
        <div className="template-detail">
          <span className="badge">{template.type}</span>
          <h3>{template.name}</h3>
          <p>{template.description}</p>
          <div className="template-specs">
            <div>
              <small>预计研究周期</small>
              <b>{template.duration} 个月</b>
            </div>
            <div>
              <small>技术风险</small>
              <b>{format(template.risk * (template.risk <= 1 ? 100 : 1))}%</b>
            </div>
            <div>
              <small>建议首席科学家</small>
              <b>{template.talent} 位首席</b>
            </div>
            <div>
              <small>产业化潜力</small>
              <b>{template.potential} / 100</b>
            </div>
          </div>
          <label className="input-label">
            年度项目经费 <span>可用 {money(Math.max(0, left))} B</span>
            <div className="number-input">
              <span>$</span>
              <input
                aria-label="年度项目经费"
                type="number"
                min="0.1"
                step="0.1"
                value={funding}
                onChange={(e) => setFunding(+e.target.value)}
              />
              <b>B / 年</b>
            </div>
          </label>
          <div className="requirements">
            <small>前置科技能力</small>
            {Object.entries(template.requirements).map(([f, value]) => (
              <span
                className={
                  country.fields[f as FieldId] >= value! ? "met" : "unmet"
                }
                key={f}
              >
                {FIELD_META[f as FieldId].name} ≥ {value}{" "}
                {country.fields[f as FieldId] >= value! ? "✓" : "· 未满足"}
              </span>
            ))}
          </div>
          <label className="input-label">配置首席科学家</label>
          <div className="scientist-options">
            {scientists.map((s) => (
              <label
                className={!available(s.id) ? "unavailable" : ""}
                key={s.id}
              >
                <input
                  type="checkbox"
                  checked={ids.includes(s.id)}
                  disabled={!available(s.id)}
                  onChange={(e) =>
                    setIds((a) =>
                      e.target.checked
                        ? [...a, s.id]
                        : a.filter((x) => x !== s.id),
                    )
                  }
                />
                <span>
                  {s.name}
                  <small>
                    {FIELD_META[s.field].name} · 能力 {s.ability}
                    {s.field !== template.field
                      ? " · 领域不符"
                      : !available(s.id)
                        ? " · 已分配"
                        : ""}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="modal-bottom">
        <span>预计周期存在不确定性，科研可能遭遇瓶颈或失败。</span>
        <button
          className="button primary"
          onClick={() => onSubmit(chosen, funding, ids)}
        >
          <FlaskConical size={16} /> 批准项目立项
        </button>
      </div>
    </>
  );
}
function ProjectModal({
  project: p,
  world,
  onFunding,
  onAssign,
  onCommercialize,
  onTerminate,
}: {
  project: Project;
  world: World;
  onFunding: (id: string, n: number) => void;
  onAssign: (id: string, ids: string[]) => void;
  onCommercialize: (id: string) => void;
  onTerminate: (id: string) => void;
}) {
  const t = TECHNOLOGIES.find((x) => x.id === p.templateId)!;
  const [funding, setFunding] = useState(p.funding);
  const [selectedIds, setSelectedIds] = useState(p.scientists);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const research = ["research", "bottleneck", "engineering"].includes(p.status);
  return (
    <>
      <span className="eyebrow">RESEARCH PROJECT DOSSIER</span>
      <h2>{p.name}</h2>
      <span className={`status status-${p.status}`}>{STATUS[p.status]}</span>
      <p className="event-detail">{t.description}</p>
      <div className="project-detail-progress">
        <span>
          {p.status === "engineering" ? "工程化进度" : "科研进度"}
          <b>
            {format(
              p.status === "engineering" ? p.engineeringProgress : p.progress,
            )}
            %
          </b>
        </span>
        <Bar
          value={
            p.status === "engineering" ? p.engineeringProgress : p.progress
          }
          color={FIELD_META[p.field].color}
        />
      </div>
      <div className="template-specs">
        <div>
          <small>累计经费</small>
          <b>{money(p.spent)} B</b>
        </div>
        <div>
          <small>成果质量</small>
          <b>{format(p.quality)} / 100</b>
        </div>
        <div>
          <small>工程化难度</small>
          <b>{t.engineering} / 100</b>
        </div>
        <div>
          <small>产业收益</small>
          <b>{money(p.revenue)} B</b>
        </div>
      </div>
      {(research ||
        p.status === "breakthrough" ||
        p.status === "engineering") && (
        <>
          {research && (
            <label className="input-label">
              年度项目经费
              <div className="inline-input">
                <input
                  aria-label="调整项目年度经费"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={funding}
                  onChange={(e) => setFunding(+e.target.value)}
                />
                <span>B / 年</span>
                <button
                  className="button"
                  onClick={() => onFunding(p.id, funding)}
                >
                  更新经费
                </button>
              </div>
            </label>
          )}
          <label className="input-label">首席科学家配置</label>
          <div className="scientist-options">
            {world.scientists
              .filter((s) => s.country === world.player)
              .map((s) => {
                const occupied =
                  s.field !== p.field ||
                  world.projects.some(
                    (other) =>
                      other.id !== p.id &&
                      ["research", "bottleneck", "engineering"].includes(
                        other.status,
                      ) &&
                      other.scientists.includes(s.id),
                  );
                return (
                  <label key={s.id} className={occupied ? "unavailable" : ""}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      disabled={occupied}
                      onChange={(e) =>
                        setSelectedIds((ids) =>
                          e.target.checked
                            ? [...ids, s.id]
                            : ids.filter((id) => id !== s.id),
                        )
                      }
                    />
                    <span>
                      {s.name}
                      <small>
                        {FIELD_META[s.field].name} ·{" "}
                        {s.field !== p.field
                          ? "领域不符"
                          : occupied
                            ? "其他项目占用"
                            : `能力 ${s.ability}`}
                      </small>
                    </span>
                  </label>
                );
              })}
          </div>
          <button
            className="button full-width"
            onClick={() => onAssign(p.id, selectedIds)}
          >
            更新人才配置
          </button>
        </>
      )}
      <div className="project-log">
        <h3>科研记录</h3>
        {p.log.slice(0, 5).map((log, i) => (
          <p key={i}>
            <span className="live-dot" />
            {log}
          </p>
        ))}
      </div>
      {p.status === "breakthrough" && (
        <button
          className="button primary full-width"
          onClick={() => onCommercialize(p.id)}
        >
          <Factory size={16} /> 投资工程化验证 ·{" "}
          {money(t.funding * (1 + t.engineering / 100))} B
        </button>
      )}
      {research && (
        <button
          className="text-button danger"
          onClick={() => {
            if (confirmEnd) onTerminate(p.id);
            else setConfirmEnd(true);
          }}
        >
          {confirmEnd
            ? "再次点击确认终止 · 已投入经费不会退还"
            : "终止科研项目"}
        </button>
      )}
    </>
  );
}
function TrendChart({ world }: { world: World }) {
  const points = world.history.length
    ? world.history
    : [
        {
          date: world.date,
          scores: Object.fromEntries(
            world.countries.map((c) => [c.id, score(c)]),
          ),
        },
      ];
  return (
    <div className="trend-chart">
      <svg
        viewBox="0 0 1000 220"
        role="img"
        aria-label="国家综合科技指数季度走势"
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6bc5cb" stopOpacity=".15" />
            <stop offset="100%" stopColor="#6bc5cb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 60, 80, 100].map((n) => (
          <g key={n}>
            <line
              x1="45"
              y1={190 - (n - 30) * 2}
              x2="980"
              y2={190 - (n - 30) * 2}
              stroke="#24333e"
              strokeDasharray="3 5"
            />
            <text x="0" y={194 - (n - 30) * 2} fill="#8094a1" fontSize="11">
              {n}
            </text>
          </g>
        ))}
        {world.countries.map((c) => {
          const line = points
            .map(
              (p, i) =>
                `${45 + (i / Math.max(1, points.length - 1)) * 920},${190 - ((p.scores[c.id] || score(c)) - 30) * 2}`,
            )
            .join(" ");
          return (
            <g key={c.id}>
              <polyline
                points={line}
                fill="none"
                stroke={c.color}
                strokeWidth={c.id === world.player ? 3 : 1.5}
                opacity={c.id === world.player ? 1 : 0.6}
              />
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={45 + (i / Math.max(1, points.length - 1)) * 920}
                  cy={190 - ((p.scores[c.id] || score(c)) - 30) * 2}
                  r="3"
                  fill={c.color}
                />
              ))}
            </g>
          );
        })}
        {points
          .filter((_, i) => i === 0 || i === points.length - 1)
          .map((p) => (
            <text
              key={p.date}
              x={p === points[0] ? 45 : 900}
              y="215"
              fill="#8094a1"
              fontSize="11"
            >
              {dateLabel(p.date)}
            </text>
          ))}
      </svg>
      <div className="chart-legend">
        {world.countries.map((c) => (
          <span key={c.id}>
            <i style={{ background: c.color }} />
            {c.name}
          </span>
        ))}
      </div>
    </div>
  );
}
export default App;
