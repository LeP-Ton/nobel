import {
  COUNTRIES,
  SCIENTISTS,
  INSTITUTIONS,
  TECHNOLOGIES,
  HISTORICAL_EVENTS,
  FIELD_META,
} from "./data";
import type {
  ActionResult,
  Country,
  FieldId,
  Fields,
  GameEvent,
  Project,
  Scientist,
  World,
} from "./types";

export const FIELD_IDS: FieldId[] = [
  "ai",
  "chips",
  "energy",
  "manufacturing",
  "bio",
];
const ACTIVE = new Set(["research", "bottleneck", "engineering"]);
const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));
const copy = <T>(value: T): T => structuredClone(value);
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const average = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const playerOf = (world: World) =>
  world.countries.find((country) => country.id === world.player)!;
const templateOf = (project: Project) =>
  TECHNOLOGIES.find((template) => template.id === project.templateId)!;

// 随机状态跟随存档，保证同一存档与相同操作能够重放相同历史。
function random(world: World): number {
  world.seed = (Math.imul(1664525, world.seed) + 1013904223) >>> 0;
  return world.seed / 4294967296;
}

function event(world: World, value: Omit<GameEvent, "id" | "date">) {
  world.events.unshift({
    ...value,
    id: `${world.date}-${world.seed}-${world.events.length}`,
    date: world.date,
  });
  // 保留重要科研事件；历史档案由独立种子资料提供，年度统计使用项目本身计算。
  if (world.events.length > 500) world.events.length = 500;
}

export function score(country: Country): number {
  const weights: Fields = {
    ai: 0.22,
    chips: 0.22,
    energy: 0.2,
    manufacturing: 0.18,
    bio: 0.18,
  };
  const science = FIELD_IDS.reduce(
    (total, field) => total + country.fields[field] * weights[field],
    0,
  );
  return round(
    science * 0.63 +
      country.industry * 0.19 +
      country.attraction * 0.1 +
      country.influence * 0.08,
  );
}

export function ranked(world: World): Country[] {
  return [...world.countries].sort(
    (a, b) => score(b) - score(a) || a.id.localeCompare(b.id),
  );
}

function snapshot(world: World) {
  world.history.push({
    date: world.date,
    scores: Object.fromEntries(
      world.countries.map((country) => [country.id, score(country)]),
    ),
  });
  if (world.history.length > 80) world.history.shift();
}

function projectCapacity(
  world: World,
  field: FieldId,
  budget = playerOf(world).budget,
  allocations = playerOf(world).allocations,
) {
  return ((budget * allocations[field]) / 100) * (1 - world.policy.basic / 100);
}

function committed(world: World, field: FieldId, except?: string): number {
  return world.projects
    .filter(
      (project) =>
        project.id !== except &&
        project.field === field &&
        ACTIVE.has(project.status),
    )
    .reduce((total, project) => total + project.funding, 0);
}

function eligibleScientists(
  world: World,
  ids: string[],
  field: FieldId,
  except?: string,
): string | undefined {
  if (new Set(ids).size !== ids.length) return "同一位科学家不能重复配置。";
  for (const id of ids) {
    const scientist = world.scientists.find((item) => item.id === id);
    if (!scientist || scientist.country !== world.player)
      return "只能配置本国当前人才池中的科学家。";
    if (scientist.field !== field) return "科学家的专业领域与项目不匹配。";
    if (
      world.projects.some(
        (project) =>
          project.id !== except &&
          ACTIVE.has(project.status) &&
          project.scientists.includes(id),
      )
    ) {
      return `${scientist.name} 已加入其他进行中的项目。`;
    }
  }
}

export function createWorld(playerId: string, seed = 20260101): World {
  if (!COUNTRIES.some((country) => country.id === playerId && country.playable))
    throw new Error("当前仅开放美国和中国。");
  const world: World = {
    version: 1,
    seed: seed >>> 0,
    date: "2026-01-01",
    player: playerId,
    countries: COUNTRIES.map((country) => ({
      ...copy(country),
      treasury: round(country.rd * 0.28),
      budget: country.rd,
      allocations: {
        ai: 24,
        chips: 24,
        energy: 20,
        manufacturing: 17,
        bio: 15,
      },
      progress: { ai: 0, chips: 0, energy: 0, manufacturing: 0, bio: 0 },
      patents: 0,
      influence:
        average(Object.values(country.fields)) * 0.7 + country.attraction * 0.3,
      aiProjects: 0,
      industryRevenue: 0,
    })),
    projects: [],
    scientists: copy(SCIENTISTS),
    institutions: copy(INSTITUTIONS),
    events: copy(HISTORICAL_EVENTS)
      .filter((item) => item.date < "2026-01-01")
      .sort((a, b) => b.date.localeCompare(a.date)),
    reports: [],
    policy: { basic: 25, cooperation: true, talent: false },
    history: [],
  };
  const usedFields = new Set<FieldId>();
  for (const template of [...TECHNOLOGIES].sort(
    (a, b) => a.funding - b.funding,
  )) {
    if (world.projects.length >= 3) break;
    if (usedFields.has(template.field)) continue;
    const scientist = world.scientists.find(
      (item) => item.country === playerId && item.field === template.field,
    );
    if (!scientist) continue;
    const result = startProject(world, template.id, template.funding, [
      scientist.id,
    ]);
    if (result.error) continue;
    const project = result.world.projects.at(-1)!;
    project.progress = 25 + world.projects.length * 10;
    project.log = [
      "继承开局前的研究积累，后续进展由资源配置和科研条件决定。",
      ...project.log.filter((line) => line.includes("参与研究机构")),
    ];
    world.projects.push(project);
    usedFields.add(template.field);
  }
  snapshot(world);
  event(world, {
    type: "world",
    country: playerId,
    title: "国家科技战略办公室已就绪",
    description:
      "2026 年模拟开始。三项继承项目已配置人才；可调整预算、创建新项目并推进时间。未来事件均为模拟推演。",
  });
  return world;
}

export function startProject(
  world: World,
  templateId: string,
  funding: number,
  scientistIds: string[],
): ActionResult {
  const template = TECHNOLOGIES.find((item) => item.id === templateId);
  if (!template) return { world, error: "未找到科研方向。" };
  if (
    !Number.isFinite(funding) ||
    funding <= 0 ||
    funding > template.funding * 4
  )
    return { world, error: "科研投入须为正数，且不能超过建议预算的四倍。" };
  if (
    world.projects.some(
      (item) =>
        item.templateId === templateId &&
        !["terminated", "failed"].includes(item.status),
    )
  )
    return { world, error: "该研究方向已经立项或取得成果。" };
  const country = playerOf(world);
  const missing = Object.entries(template.requirements).find(
    ([field, minimum]) => country.fields[field as FieldId] < minimum!,
  );
  if (missing)
    return {
      world,
      error: `前置技术不足：${FIELD_META[missing[0] as FieldId].name} 需要 ${missing[1]} 点科研能力。`,
    };
  if (!scientistIds.length)
    return { world, error: "请至少配置一位专业科学家。" };
  const talentError = eligibleScientists(world, scientistIds, template.field);
  if (talentError) return { world, error: talentError };
  if (
    committed(world, template.field) + funding >
    projectCapacity(world, template.field) + 0.001
  )
    return {
      world,
      error: "该领域可用应用研究预算不足，请先调整年度科研预算或领域分配。",
    };
  const next = copy(world);
  const researchInstitutions = [
    ...new Set(
      scientistIds.map((id) => {
        const scientist = world.scientists.find((item) => item.id === id)!;
        return (
          world.institutions.find(
            (item) =>
              item.id === scientist.institution ||
              item.name === scientist.institution,
          )?.name ?? scientist.institution
        );
      }),
    ),
  ];
  const project: Project = {
    id: `project-${world.date}-${world.projects.length + 1}`,
    templateId,
    name: template.name,
    field: template.field,
    status: "research",
    progress: 0,
    funding,
    scientists: [...scientistIds],
    started: world.date,
    spent: 0,
    risk: template.risk,
    quality: 0,
    engineeringProgress: 0,
    revenue: 0,
    log: [
      `${world.date} 立项，年度投入 ${round(funding)} 十亿美元。`,
      `${world.date} 参与研究机构：${researchInstitutions.join("、")}。`,
    ],
  };
  next.projects.push(project);
  event(next, {
    type: "research",
    country: next.player,
    field: template.field,
    title: `${template.name} 正式立项`,
    description: `配置 ${scientistIds.length} 位重点科学家，建议研究周期 ${template.duration} 个月。实际进度受人才、经费、依赖技术与研究风险影响。`,
  });
  return { world: next };
}

export function updateBudget(
  world: World,
  budget: number,
  allocations: Fields,
): ActionResult {
  if (
    !Number.isFinite(budget) ||
    budget <= 0 ||
    budget > playerOf(world).gdp * 0.06
  )
    return {
      world,
      error: "年度科研预算须大于零，且不能超过 GDP 的 6% 财政上限。",
    };
  if (
    FIELD_IDS.some(
      (field) =>
        !Number.isFinite(allocations[field]) ||
        allocations[field] < 0 ||
        allocations[field] > 100,
    ) ||
    Math.abs(
      FIELD_IDS.reduce((sum, field) => sum + allocations[field], 0) - 100,
    ) > 0.01
  )
    return { world, error: "五大领域的预算分配比例必须合计为 100%。" };
  if (
    FIELD_IDS.some(
      (field) =>
        committed(world, field) >
        projectCapacity(world, field, budget, allocations) + 0.001,
    )
  )
    return {
      world,
      error: "新的预算不足以支持已承诺的项目，请先降低项目投入或终止项目。",
    };
  const next = copy(world);
  const country = playerOf(next);
  country.budget = round(budget);
  country.allocations = copy(allocations);
  event(next, {
    type: "world",
    country: world.player,
    title: "国家科研预算调整",
    description: `年度科研预算为 ${round(budget)} 十亿美元，占 GDP 的 ${round((budget / country.gdp) * 100)}%。基础研究占比 ${next.policy.basic}%。`,
  });
  return { world: next };
}

export function setPolicy(
  world: World,
  key: "basic" | "cooperation" | "talent",
  value: number | boolean,
): World {
  if (key === "basic" && (typeof value !== "number" || !Number.isFinite(value)))
    return world;
  if (key !== "basic" && typeof value !== "boolean") return world;
  const next = copy(world);
  if (key === "basic") {
    next.policy.basic = clamp(value as number, 10, 60);
    if (
      FIELD_IDS.some(
        (field) => committed(next, field) > projectCapacity(next, field),
      )
    )
      return world;
  } else next.policy[key] = value as boolean;
  return next;
}

export function assignScientists(
  world: World,
  projectId: string,
  ids: string[],
): ActionResult {
  const project = world.projects.find((item) => item.id === projectId);
  if (
    !project ||
    (!ACTIVE.has(project.status) && project.status !== "breakthrough")
  )
    return { world, error: "该项目当前不支持调整团队。" };
  if (!ids.length) return { world, error: "项目至少需要一位科学家。" };
  const error = eligibleScientists(world, ids, project.field, projectId);
  if (error) return { world, error };
  const next = copy(world);
  next.projects.find((item) => item.id === projectId)!.scientists = [...ids];
  return { world: next };
}

export function changeProjectFunding(
  world: World,
  projectId: string,
  funding: number,
): ActionResult {
  const project = world.projects.find((item) => item.id === projectId);
  if (!project || !ACTIVE.has(project.status))
    return { world, error: "该项目当前不支持调整投入。" };
  if (
    !Number.isFinite(funding) ||
    funding <= 0 ||
    funding > templateOf(project).funding * 4
  )
    return {
      world,
      error: "请输入合理的正数年度项目投入，最高为建议预算四倍。",
    };
  if (
    committed(world, project.field, projectId) + funding >
    projectCapacity(world, project.field) + 0.001
  )
    return { world, error: "该领域预算不足。" };
  const next = copy(world);
  next.projects.find((item) => item.id === projectId)!.funding = funding;
  return { world: next };
}

export function terminateProject(world: World, projectId: string): World {
  const next = copy(world);
  const project = next.projects.find((item) => item.id === projectId);
  if (!project || !ACTIVE.has(project.status)) return world;
  project.status = "terminated";
  project.log.unshift(`${world.date} 战略终止；已投入资金无法收回。`);
  event(next, {
    type: "research",
    country: world.player,
    field: project.field,
    title: `${project.name} 已终止`,
    description: "释放科研团队与未来年度预算，保留已投入资金和研究日志。",
  });
  return next;
}

export function commercialize(world: World, projectId: string): ActionResult {
  const project = world.projects.find((item) => item.id === projectId);
  if (!project || project.status !== "breakthrough")
    return { world, error: "只有已取得突破的项目可以进入工程化。" };
  if (!project.scientists.length)
    return { world, error: "工程化前请至少配置一位本国专业科学家。" };
  const cost = round(
    templateOf(project).funding * (1 + templateOf(project).engineering / 100),
  );
  if (playerOf(world).treasury < cost)
    return { world, error: `工程化启动需要 ${cost} 十亿美元财政储备。` };
  if (
    committed(world, project.field, projectId) + project.funding >
    projectCapacity(world, project.field) + 0.001
  )
    return { world, error: "该领域年度预算不足以支持工程化。" };
  const talentError = eligibleScientists(
    world,
    project.scientists,
    project.field,
    projectId,
  );
  if (talentError)
    return {
      world,
      error: "原研究团队已被其他项目使用，请先调整其团队或完成其他项目。",
    };
  const next = copy(world);
  const updated = next.projects.find((item) => item.id === projectId)!;
  playerOf(next).treasury = round(playerOf(next).treasury - cost);
  updated.status = "engineering";
  updated.spent += cost;
  updated.log.unshift(
    `${world.date} 启动工程化，支付 ${cost} 十亿美元建设资金。`,
  );
  event(next, {
    type: "industry",
    country: world.player,
    field: project.field,
    title: `${project.name} 进入工程化验证`,
    description:
      "技术突破需要中试、可靠性验证和生产线适配；工程能力与制造成本将影响商业收益。",
  });
  return { world: next };
}

export function investInstitution(world: World, id: string): ActionResult {
  const institution = world.institutions.find(
    (item) => item.id === id && item.country === world.player,
  );
  if (!institution) return { world, error: "只能投资本国科研机构。" };
  if (institution.level >= 10)
    return { world, error: "机构设备已达到最高等级。" };
  const cost = 2 + institution.level * 0.8;
  if (playerOf(world).treasury < cost)
    return { world, error: `设备扩建需要 ${round(cost)} 十亿美元财政储备。` };
  const next = copy(world);
  const updated = next.institutions.find((item) => item.id === id)!;
  updated.level += 1;
  updated.researchers = Math.round(updated.researchers * 1.08);
  updated.reputation = clamp(updated.reputation + 1);
  playerOf(next).treasury = round(playerOf(next).treasury - cost);
  event(next, {
    type: "research",
    country: next.player,
    field: institution.field,
    title: `${institution.name} 完成扩建`,
    description: `投入 ${round(cost)} 十亿美元，设备等级提升至 ${updated.level}，提高本领域研究能力。`,
  });
  return { world: next };
}

function researchMonth(world: World) {
  const country = playerOf(world);
  for (const project of world.projects) {
    const template = templateOf(project);
    if (!template) continue;
    if (project.status === "production") {
      const manufacturing =
        (country.fields.manufacturing + country.industry) / 200;
      // 市场回报受工程能力和质量约束，原创先发不直接等于市场垄断。
      const revenue =
        (template.funding *
          (template.potential / 100) *
          (project.quality / 100) *
          manufacturing *
          (0.7 + random(world) * 0.6)) /
        5;
      project.revenue = round(project.revenue + revenue);
      country.industryRevenue = round(country.industryRevenue + revenue);
      country.treasury = round(country.treasury + revenue * 0.28);
      continue;
    }
    if (!ACTIVE.has(project.status)) continue;
    const scientists = project.scientists
      .map((id) => world.scientists.find((item) => item.id === id))
      .filter((item): item is Scientist =>
        Boolean(item && item.country === world.player),
      );
    const fundingFactor = Math.pow(
      Math.min(2, project.funding / template.funding),
      0.6,
    );
    const talentFactor = Math.min(1.35, scientists.length / template.talent);
    const capability =
      (0.6 + country.fields[project.field] / 150) *
      (0.55 + average(scientists.map((item) => item.ability)) / 150);
    const equipment =
      1 +
      average(
        world.institutions
          .filter(
            (item) =>
              item.country === world.player && item.field === project.field,
          )
          .map((item) => item.level),
      ) /
        35;
    const dependencies = Math.min(
      1,
      ...Object.entries(template.requirements).map(
        ([field, minimum]) =>
          country.fields[field as FieldId] / Math.max(1, minimum!),
      ),
    );
    project.spent = round(project.spent + project.funding / 12);
    if (project.status === "engineering") {
      const step =
        14 *
        fundingFactor *
        talentFactor *
        (0.35 + country.industry / 100) *
        (1 - template.engineering / 180) *
        (0.7 + random(world) * 0.6);
      project.engineeringProgress = round(
        clamp(project.engineeringProgress + step),
      );
      if (project.engineeringProgress >= 100) {
        project.status = "production";
        country.industry = clamp(country.industry + 1.5);
        project.log.unshift(`${world.date} 完成工程验证，进入规模化生产。`);
        event(world, {
          type: "industry",
          country: world.player,
          field: project.field,
          title: `${project.name} 实现产业化`,
          description:
            "完成工程验证并进入规模化应用，后续营收受成果质量、制造水平和市场条件影响。",
        });
      }
      continue;
    }
    if (project.status === "bottleneck") {
      if (
        random(world) <
        0.22 + average(scientists.map((item) => item.innovation)) / 300
      ) {
        project.status = "research";
        project.log.unshift(`${world.date} 团队找到替代路线，研究瓶颈解除。`);
        event(world, {
          type: "research",
          country: world.player,
          field: project.field,
          title: `${project.name} 走出研究瓶颈`,
          description:
            "团队通过方法调整恢复研究；已支付的探索成本保留在项目账目中。",
        });
      }
      continue;
    }
    const uncertainty = 0.65 + random(world) * 0.7;
    const step =
      (100 / Math.max(3, template.duration)) *
      fundingFactor *
      talentFactor *
      capability *
      equipment *
      dependencies *
      (1 - template.difficulty / 300) *
      (1 + world.policy.basic / 200) *
      (world.policy.cooperation ? 1.06 : 0.96) *
      uncertainty;
    const previous = project.progress;
    project.progress = round(clamp(project.progress + step));
    if (project.progress >= 100) {
      const innovation = average(scientists.map((item) => item.innovation));
      if (random(world) < (template.risk / 350) * (1.2 - innovation / 200)) {
        project.status = "failed";
        project.log.unshift(`${world.date} 关键实验未能复现，项目失败。`);
        event(world, {
          type: "research",
          country: world.player,
          field: project.field,
          title: `${project.name} 未通过最终验证`,
          description:
            "关键实验无法稳定复现。研究投入形成经验积累，但没有形成可产业化成果。",
        });
        country.fields[project.field] = clamp(
          country.fields[project.field] + 0.3,
        );
      } else {
        project.status = "breakthrough";
        project.quality = round(
          clamp(
            50 +
              innovation * 0.35 +
              country.fields[project.field] * 0.15 +
              random(world) * 8,
          ),
        );
        country.fields[project.field] = clamp(
          country.fields[project.field] + 1 + project.quality / 60,
        );
        country.patents += Math.max(1, Math.round(project.quality / 15));
        for (const scientist of scientists)
          scientist.reputation = clamp(scientist.reputation + 3);
        project.log.unshift(
          `${world.date} 取得技术突破，成果质量 ${project.quality}。`,
        );
        event(world, {
          type: "research",
          country: world.player,
          field: project.field,
          title: `${project.name} 取得技术突破`,
          description: `成果质量 ${project.quality}/100，科研能力提升，形成专利。可投入工程化，将实验室成果转化为产业价值。`,
        });
      }
    } else if (random(world) < template.risk / 1000) {
      project.status = "bottleneck";
      project.log.unshift(`${world.date} 实验遇到瓶颈，团队正在寻找新路线。`);
      event(world, {
        type: "research",
        country: world.player,
        field: project.field,
        title: `${project.name} 遭遇研究瓶颈`,
        description:
          "实验路线暂时受阻。团队的创新能力、持续投入和后续探索将决定恢复时间。",
      });
    } else if (Math.floor(previous / 25) < Math.floor(project.progress / 25)) {
      project.log.unshift(
        `${world.date} 阶段验证完成，进度达到 ${Math.floor(project.progress)}%。`,
      );
      event(world, {
        type: "research",
        country: world.player,
        field: project.field,
        title: `${project.name} 完成阶段验证`,
        description: `研究进度 ${Math.floor(project.progress)}%。当前投入 ${round(project.funding)} 十亿美元/年，配置 ${scientists.length} 位重点科学家。`,
      });
    }
  }
  // 基础科学按预算、人才密度和设备能力积累，边际回报随国家能力提升而降低。
  for (const field of FIELD_IDS) {
    const investment =
      (((country.budget * country.allocations[field]) / 100) *
        world.policy.basic) /
      100;
    const density = Math.log1p(
      investment / Math.max(0.1, country.population / 100),
    );
    country.fields[field] = round(
      clamp(
        country.fields[field] +
          density * 0.025 * (1.25 - country.fields[field] / 150),
      ),
      4,
    );
  }
  country.treasury = round(
    Math.min(
      country.gdp * 0.03,
      country.treasury + (country.budget * 0.012) / 12,
    ),
  );
}

function aiMonth(world: World) {
  for (const country of world.countries) {
    if (country.id === world.player) continue;
    const priorities = [...FIELD_IDS].sort(
      (a, b) => country.fields[b] - country.fields[a],
    );
    // AI保留优势赛道，同时配置追赶领域；投入和真实初始人才规模共同决定完成率。
    const weakest = priorities.at(-1)!;
    const raw = Object.fromEntries(
      FIELD_IDS.map((field) => [
        field,
        field === priorities[0] ? 30 : field === weakest ? 23 : 47 / 3,
      ]),
    ) as Fields;
    country.allocations = raw;
    for (const field of FIELD_IDS) {
      const funding = (country.budget * raw[field]) / 100;
      const template = TECHNOLOGIES.find(
        (item) => item.field === field && item.type === "成熟技术",
      );
      if (!template) continue;
      const nationalScale = Math.max(0.2, country.population / 600);
      const talentDensity = Math.min(
        1.5,
        country.researchers / Math.max(10, country.population),
      );
      const effort =
        Math.log1p(funding / nationalScale) *
        (0.4 + talentDensity) *
        (0.55 + country.fields[field] / 150);
      // AI使用相同技术前置和资源约束；宏观进度0–100为科研，100–200为工程化。
      // AI普通团队聚合结算，避免创建数千个不需要玩家逐个管理的项目对象。
      if (country.progress[field] < 100) {
        const dependencies = Object.entries(template.requirements).every(
          ([dependency, minimum]) =>
            country.fields[dependency as FieldId] >= minimum!,
        );
        if (dependencies && random(world) >= template.risk / 1000) {
          country.progress[field] +=
            effort *
            (1.5 + random(world) * 0.7) *
            (1 - template.difficulty / 300);
          if (country.progress[field] >= 100) {
            if (random(world) < template.risk / 400) {
              country.progress[field] = 65;
              event(world, {
                type: "world",
                country: country.id,
                field,
                title: `${country.name} 的研究路线未通过验证`,
                description: `该国 ${template.name} 项目需要重新探索，投入无法保证技术突破。此为模拟事件。`,
              });
            } else {
              country.progress[field] = 100;
              country.fields[field] = clamp(
                country.fields[field] + 1.2 + country.industry / 100,
              );
              country.patents += Math.max(
                1,
                Math.round(country.fields[field] / 20),
              );
              country.aiProjects += 1;
              event(world, {
                type: "world",
                country: country.id,
                field,
                title: `${country.name} 科研团队完成技术验证`,
                description: `该领域年度投入 ${round(funding)} 十亿美元，人才与依赖技术支持本次成果；随后进入工程化阶段，尚未产生商业收入。此为模拟事件。`,
              });
            }
          }
        }
      } else {
        const engineering =
          14 *
          (0.35 + country.industry / 100) *
          (1 - template.engineering / 180) *
          (0.7 + random(world) * 0.6);
        country.progress[field] += engineering;
        if (country.progress[field] >= 200) {
          country.progress[field] = 0;
          const commercialValue =
            ((((funding * country.industry) / 100) * template.potential) /
              100) *
            0.04;
          country.industryRevenue = round(
            country.industryRevenue + commercialValue,
          );
          country.industry = clamp(country.industry + 0.25);
          event(world, {
            type: "industry",
            country: country.id,
            field,
            title: `${country.name} 完成科研成果产业化`,
            description: `${template.name} 通过工程验证，按制造水平与市场潜力形成 ${round(commercialValue)} 十亿美元产业营收。此为模拟事件。`,
          });
        }
      }
      country.fields[field] = round(
        clamp(
          country.fields[field] +
            effort * 0.003 * (1.2 - country.fields[field] / 200),
        ),
        4,
      );
    }
    country.budget = round(
      Math.min(country.gdp * 0.06, country.budget * 1.0008),
    );
  }
}

function talentMonth(world: World) {
  if (world.policy.talent) {
    const player = playerOf(world);
    player.attraction = clamp(player.attraction + 0.035);
    if (random(world) < 0.09) {
      const candidates = world.scientists.filter(
        (scientist) =>
          scientist.country !== world.player && scientist.simulated,
      );
      const recruit = candidates[Math.floor(random(world) * candidates.length)];
      if (recruit) {
        const origin = world.countries.find(
          (country) => country.id === recruit.country,
        )!;
        const targetInstitution = world.institutions.find(
          (item) =>
            item.country === world.player && item.field === recruit.field,
        );
        recruit.country = world.player;
        recruit.institution = targetInstitution?.id ?? recruit.institution;
        event(world, {
          type: "talent",
          country: world.player,
          field: recruit.field,
          title: `${recruit.name} 加入本国科研体系`,
          description: `人才政策吸引该模拟科学家从 ${origin.name} 流入，现可配置至相应科研项目。人才流动不按出生地归属计算。`,
        });
      }
    }
  } else if (random(world) < 0.015) {
    const candidate = world.scientists.find(
      (scientist) =>
        scientist.country === world.player &&
        !world.projects.some(
          (project) =>
            ACTIVE.has(project.status) &&
            project.scientists.includes(scientist.id),
        ),
    );
    const destination = ranked(world).find(
      (country) =>
        country.id !== world.player &&
        country.attraction > playerOf(world).attraction,
    );
    if (candidate && destination) {
      candidate.country = destination.id;
      candidate.institution =
        world.institutions.find((item) => item.country === destination.id)
          ?.id ?? candidate.institution;
      event(world, {
        type: "talent",
        country: destination.id,
        field: candidate.field,
        title: `${candidate.name} 接受海外科研职位`,
        description:
          "长期未参与重点项目，加上更高的人才吸引力，促成这位模拟科学家的跨国流动。",
      });
    }
  }
}

function annualReport(world: World, year: number) {
  const player = playerOf(world);
  const yearProjects = world.projects.filter((project) =>
    project.log.some(
      (log) => log.startsWith(`${year}-`) && log.includes("取得技术突破"),
    ),
  );
  const report = {
    year,
    country: world.player,
    rank: ranked(world).findIndex((country) => country.id === world.player) + 1,
    score: score(player),
    breakthroughs: yearProjects.length,
    patents:
      player.patents -
      world.reports.reduce((total, item) => total + item.patents, 0),
    revenue: round(
      world.projects.reduce((total, project) => total + project.revenue, 0) -
        world.reports.reduce((total, item) => total + item.revenue, 0),
    ),
    spent: round(
      world.projects.reduce((total, project) => total + project.spent, 0) -
        world.reports.reduce((total, item) => total + item.spent, 0),
    ),
    fields: copy(player.fields),
    summary: `完成 ${yearProjects.length} 项技术突破，${world.projects.filter((project) => project.status === "production").length} 项成果进入规模化应用。国家科研综合实力 ${score(player)}，全球排名第 ${ranked(world).findIndex((country) => country.id === world.player) + 1}。`,
  };
  world.reports.unshift(report);
  event(world, {
    type: "report",
    country: world.player,
    title: `${year} 年度国家科技报告`,
    description: report.summary,
  });
  for (const country of world.countries)
    country.gdp = round(country.gdp * (1.01 + country.industry / 5000));
}

function simulatedAwards(world: World) {
  const successful = world.projects.filter(
    (project) =>
      ["breakthrough", "engineering", "production"].includes(project.status) &&
      !project.log.some((line) => line.includes("获得模拟科学奖项")),
  );
  if (!successful.length) return;
  const project = [...successful].sort((a, b) => b.quality - a.quality)[0];
  const scientist = world.scientists.find(
    (item) => item.id === project.scientists[0],
  );
  if (!scientist) return;
  const award =
    project.field === "ai"
      ? "图灵奖"
      : project.field === "bio"
        ? "诺贝尔生理学或医学奖"
        : project.field === "energy"
          ? "诺贝尔化学奖"
          : "突破奖";
  if (random(world) < project.quality / 180) {
    scientist.reputation = clamp(scientist.reputation + 5);
    const country = playerOf(world);
    country.influence = clamp(country.influence + 1.2);
    const institution = world.institutions.find(
      (item) =>
        item.country === world.player &&
        project.log.some(
          (line) => line.includes("参与研究机构") && line.includes(item.name),
        ),
    );
    if (institution) institution.reputation = clamp(institution.reputation + 2);
    project.log.unshift(`${world.date} 研究贡献获得模拟科学奖项：${award}。`);
    const currentCountry = world.countries.find(
      (item) => item.id === scientist.country,
    )!;
    event(world, {
      type: "award",
      country: world.player,
      field: project.field,
      title: `${scientist.name} 获得 ${award}（模拟）`,
      description: `因「${project.name}」获得模拟奖项。研究贡献发生于${country.name}，研究机构为${institution?.name ?? "项目合作团队"}；获奖者当前工作于${currentCountry.name}。研究贡献、当前工作地与国籍不混为一谈；奖项不直接增加科研能力。`,
    });
  }
}

export function advanceDays(world: World, days: number): World {
  if (!Number.isInteger(days) || days < 0 || days > 3660)
    throw new Error("单次时间推进必须为 0–3660 天的整数。");
  const next = copy(world);
  for (let day = 0; day < days; day++) {
    const date = new Date(`${next.date}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    next.date = date.toISOString().slice(0, 10);
    const tomorrow = new Date(date);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    if (tomorrow.getUTCMonth() === date.getUTCMonth()) continue;
    researchMonth(next);
    aiMonth(next);
    talentMonth(next);
    if ([2, 5, 8, 11].includes(date.getUTCMonth())) snapshot(next);
    if (date.getUTCMonth() === 9) simulatedAwards(next);
    if (date.getUTCMonth() === 11) annualReport(next, date.getUTCFullYear());
  }
  return next;
}

export function saveGame(world: World): string {
  return JSON.stringify(world);
}

function parseGame(raw: string): World {
  const invalid = () => {
    throw new Error("存档格式无效或版本不兼容，请使用 NOBEL v1 的完整存档。");
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return invalid();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return invalid();
  const world = parsed as World;
  const finite = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max;
  const validFields = (value: unknown, max = 100) =>
    value &&
    typeof value === "object" &&
    FIELD_IDS.every((field) => finite((value as Fields)[field], 0, max));
  if (
    world.version !== 1 ||
    !finite(world.seed, 0, 4294967295) ||
    !Number.isInteger(world.seed) ||
    typeof world.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(world.date) ||
    !Number.isFinite(Date.parse(`${world.date}T00:00:00Z`)) ||
    new Date(`${world.date}T00:00:00Z`).toISOString().slice(0, 10) !==
      world.date ||
    world.date < "2026-01-01" ||
    !COUNTRIES.some(
      (country) => country.id === world.player && country.playable,
    )
  )
    return invalid();
  if (
    !Array.isArray(world.countries) ||
    world.countries.length !== COUNTRIES.length ||
    new Set(world.countries.map((country) => country.id)).size !==
      COUNTRIES.length
  )
    return invalid();
  for (const country of world.countries) {
    if (
      !COUNTRIES.some((item) => item.id === country.id) ||
      !validFields(country.fields) ||
      !validFields(country.allocations) ||
      Math.abs(
        Object.values(country.allocations).reduce((a, b) => a + b, 0) - 100,
      ) > 0.01 ||
      !validFields(country.progress, 200) ||
      !finite(country.gdp, 1) ||
      !finite(country.rd) ||
      !finite(country.budget, 0.001, country.gdp * 0.06 + 1) ||
      !finite(country.treasury) ||
      !finite(country.population, 1) ||
      !finite(country.researchers) ||
      !finite(country.industry, 0, 100) ||
      !finite(country.attraction, 0, 100) ||
      !finite(country.influence, 0, 100) ||
      !finite(country.patents) ||
      !finite(country.aiProjects) ||
      !finite(country.industryRevenue)
    )
      return invalid();
  }
  if (
    !world.policy ||
    !finite(world.policy.basic, 10, 60) ||
    typeof world.policy.cooperation !== "boolean" ||
    typeof world.policy.talent !== "boolean"
  )
    return invalid();
  if (
    !Array.isArray(world.scientists) ||
    !Array.isArray(world.institutions) ||
    !Array.isArray(world.projects) ||
    !Array.isArray(world.events) ||
    !Array.isArray(world.reports) ||
    !Array.isArray(world.history)
  )
    return invalid();
  const countryIds = new Set(world.countries.map((country) => country.id));
  const scientistIds = new Set<string>();
  for (const scientist of world.scientists) {
    if (
      typeof scientist.id !== "string" ||
      scientistIds.has(scientist.id) ||
      !countryIds.has(scientist.country) ||
      !FIELD_IDS.includes(scientist.field) ||
      typeof scientist.name !== "string" ||
      typeof scientist.institution !== "string" ||
      ![
        scientist.ability,
        scientist.innovation,
        scientist.reputation,
        scientist.management,
      ].every((value) => finite(value, 0, 100))
    )
      return invalid();
    scientistIds.add(scientist.id);
  }
  for (const institution of world.institutions) {
    if (
      !countryIds.has(institution.country) ||
      !FIELD_IDS.includes(institution.field) ||
      typeof institution.name !== "string" ||
      !finite(institution.level, 0, 10) ||
      !finite(institution.reputation, 0, 100) ||
      !finite(institution.researchers)
    )
      return invalid();
  }
  const projectIds = new Set<string>();
  const assigned = new Set<string>();
  for (const project of world.projects) {
    if (
      typeof project.id !== "string" ||
      projectIds.has(project.id) ||
      !TECHNOLOGIES.some(
        (item) =>
          item.id === project.templateId && item.field === project.field,
      ) ||
      ![
        "research",
        "bottleneck",
        "breakthrough",
        "engineering",
        "production",
        "failed",
        "terminated",
      ].includes(project.status) ||
      !finite(project.progress, 0, 100) ||
      !finite(project.engineeringProgress, 0, 100) ||
      !finite(project.funding, 0.001) ||
      !finite(project.spent) ||
      !finite(project.risk, 0, 100) ||
      !finite(project.quality, 0, 100) ||
      !finite(project.revenue) ||
      !Array.isArray(project.scientists) ||
      !project.scientists.every((id) => scientistIds.has(id)) ||
      !Array.isArray(project.log) ||
      !project.log.every((line) => typeof line === "string")
    )
      return invalid();
    projectIds.add(project.id);
    if (ACTIVE.has(project.status))
      for (const id of project.scientists) {
        if (
          assigned.has(id) ||
          world.scientists.find((item) => item.id === id)?.country !==
            world.player
        )
          return invalid();
        assigned.add(id);
      }
  }
  for (const item of world.events)
    if (
      typeof item.title !== "string" ||
      typeof item.description !== "string" ||
      typeof item.date !== "string" ||
      (!countryIds.has(item.country) &&
        !(item.historical && item.country === "GLOBAL"))
    )
      return invalid();
  for (const item of world.reports)
    if (
      !finite(item.year, 2026, 9999) ||
      !finite(item.score, 0, 100) ||
      !validFields(item.fields) ||
      !countryIds.has(item.country) ||
      typeof item.summary !== "string" ||
      !finite(item.patents) ||
      !finite(item.revenue) ||
      !finite(item.spent) ||
      !finite(item.breakthroughs) ||
      !finite(item.rank, 1, world.countries.length)
    )
      return invalid();
  for (const item of world.history)
    if (
      typeof item.date !== "string" ||
      !item.scores ||
      !world.countries.every((country) =>
        finite(item.scores[country.id], 0, 100),
      )
    )
      return invalid();
  // 国家名称、坐标和来源是固定规则资料，不信任存档中的可替换元数据。
  world.countries = world.countries.map((country) => {
    const fixed = COUNTRIES.find((seed) => seed.id === country.id)!;
    return {
      ...country,
      name: fixed.name,
      english: fixed.english,
      flag: fixed.flag,
      coordinates: copy(fixed.coordinates),
      sourceIds: [...fixed.sourceIds],
      color: fixed.color,
      playable: fixed.playable,
      year: fixed.year,
      strengths: fixed.strengths,
      challenge: fixed.challenge,
    };
  });
  return copy(world);
}

export function loadGame(raw: string): World {
  try {
    return parseGame(raw);
  } catch {
    throw new Error("存档格式无效或版本不兼容，请使用 NOBEL v1 的完整存档。");
  }
}
