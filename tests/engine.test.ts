import test from "node:test";
import assert from "node:assert/strict";
import { COUNTRIES, TECHNOLOGIES } from "../src/data";
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
} from "../src/engine";

test("中美使用同一规则开局，其他国家存在且不可选择", () => {
  for (const id of ["CN", "US"]) {
    const world = createWorld(id);
    assert.equal(world.date, "2026-01-01");
    assert.equal(world.projects.length, 3);
    assert.equal(world.countries.length, COUNTRIES.length);
    assert.ok(
      world.projects.every((project) => project.scientists.length >= 1),
    );
    assert.equal(
      new Set(world.projects.flatMap((project) => project.scientists)).size,
      3,
    );
  }
  assert.throws(() => createWorld("JP"), /仅开放/);
  assert.notEqual(
    createWorld("CN").countries.find((country) => country.id === "CN")!.budget,
    createWorld("US").countries.find((country) => country.id === "US")!.budget,
  );
});

test("时间与随机状态可重放，分段推进与连续推进一致，原存档不被修改", () => {
  const initial = createWorld("CN", 43);
  const before = saveGame(initial);
  const continuous = advanceDays(initial, 365);
  const staged = advanceDays(advanceDays(initial, 90), 275);
  assert.deepEqual(staged, continuous);
  assert.equal(saveGame(initial), before);
  assert.equal(continuous.date, "2027-01-01");
  assert.equal(continuous.reports.length, 1);
  assert.equal(continuous.reports[0].year, 2026);
  assert.equal(continuous.history.length, 5);
});

test("财政上限、领域承诺和比例校验阻止无限科研投入", () => {
  const world = createWorld("US");
  const country = world.countries.find(
    (country) => country.id === world.player,
  )!;
  assert.ok(updateBudget(world, country.gdp, country.allocations).error);
  assert.ok(
    updateBudget(world, country.budget, { ...country.allocations, ai: 100 })
      .error,
  );
  assert.ok(updateBudget(world, 0.01, country.allocations).error);
  assert.ok(changeProjectFunding(world, world.projects[0].id, Infinity).error);
  assert.equal(saveGame(world), saveGame(createWorld("US")));
});

test("科学家不可跨国任意配置，也不可同时加入两个项目", () => {
  const world = createWorld("CN");
  const project = world.projects[0];
  const foreign = world.scientists.find(
    (scientist) => scientist.country !== "CN",
  )!;
  assert.ok(assignScientists(world, project.id, [foreign.id]).error);
  assert.ok(
    assignScientists(world, project.id, [
      project.scientists[0],
      project.scientists[0],
    ]).error,
  );
  assert.ok(assignScientists(world, project.id, []).error);
  const duplicateTemplate = startProject(
    world,
    project.templateId,
    project.funding,
    project.scientists,
  );
  assert.ok(duplicateTemplate.error);
});

test("每个AI国家都会研究，投入通过科技和工程能力形成可追踪成果", () => {
  const world = createWorld("CN", 7);
  const after = advanceDays(world, 730);
  for (const country of world.countries.filter(
    (country) => country.id !== world.player,
  )) {
    const advanced = after.countries.find((item) => item.id === country.id)!;
    assert.ok(score(advanced) > score(country), country.name);
    assert.ok(
      Object.values(advanced.progress).some((value) => value > 0),
      country.name,
    );
  }
  assert.ok(
    after.countries.some(
      (country) => country.id !== world.player && country.aiProjects > 0,
    ),
  );
  assert.ok(
    after.events.some(
      (event) =>
        event.type === "world" &&
        event.country !== world.player &&
        !event.historical,
    ),
  );
  assert.deepEqual(
    ranked(after).map(score),
    ranked(after)
      .map(score)
      .sort((a, b) => b - a),
  );
});

test("科研突破、工程化和投产收入是独立阶段，可完成真实玩法循环", () => {
  let world = advanceDays(createWorld("CN", 20260101), 365);
  const breakthrough = world.projects.find(
    (project) => project.status === "breakthrough",
  );
  assert.ok(breakthrough, "默认种子第一年应能取得至少一次突破");
  assert.equal(breakthrough.revenue, 0);
  const treasury = world.countries.find(
    (country) => country.id === world.player,
  )!.treasury;
  const result = commercialize(world, breakthrough.id);
  assert.equal(result.error, undefined);
  world = result.world;
  assert.equal(
    world.projects.find((project) => project.id === breakthrough.id)!.status,
    "engineering",
  );
  assert.ok(
    world.countries.find((country) => country.id === world.player)!.treasury <
      treasury,
  );
  world = advanceDays(world, 730);
  const product = world.projects.find(
    (project) => project.id === breakthrough.id,
  )!;
  assert.equal(product.status, "production");
  assert.ok(product.revenue > 0);
  assert.ok(
    world.countries.find((country) => country.id === world.player)!
      .industryRevenue > 0,
  );
  assert.equal(world.reports.length, 3);
  assert.ok(
    world.reports.every((report) => report.spent >= 0 && report.revenue >= 0),
  );
});

test("研究条件影响成果：提高合规投入会改变进度，停项释放人才与预算", () => {
  const world = createWorld("US", 100);
  const project = world.projects[0];
  const adjusted = changeProjectFunding(
    world,
    project.id,
    project.funding * 1.5,
  );
  assert.equal(adjusted.error, undefined);
  const baseline = advanceDays(world, 60).projects.find(
    (item) => item.id === project.id,
  )!;
  const funded = advanceDays(adjusted.world, 60).projects.find(
    (item) => item.id === project.id,
  )!;
  assert.ok(funded.progress > baseline.progress);
  const terminated = terminateProject(world, project.id);
  assert.equal(terminated.projects[0].status, "terminated");
  const restarted = startProject(
    terminated,
    project.templateId,
    project.funding,
    project.scientists,
  );
  assert.equal(restarted.error, undefined);
});

test("扩建科研机构真实扣款、增强设备；政策数值有边界", () => {
  const world = createWorld("CN");
  const institution = world.institutions.find(
    (item) => item.country === "CN" && item.level < 10,
  )!;
  const result = investInstitution(world, institution.id);
  assert.equal(result.error, undefined);
  assert.equal(
    result.world.institutions.find((item) => item.id === institution.id)!.level,
    institution.level + 1,
  );
  assert.ok(
    result.world.countries.find((country) => country.id === "CN")!.treasury <
      world.countries.find((country) => country.id === "CN")!.treasury,
  );
  assert.ok(setPolicy(world, "basic", 100).policy.basic <= 60);
  assert.equal(setPolicy(world, "talent", true).policy.talent, true);
  assert.ok(
    investInstitution(
      world,
      world.institutions.find((item) => item.country !== "CN")!.id,
    ).error,
  );
});

test("完整存读档可继续重放，损坏数据在运行前被拒绝", () => {
  const world = advanceDays(createWorld("US", 97), 185);
  const restored = loadGame(saveGame(world));
  assert.deepEqual(restored, world);
  assert.deepEqual(advanceDays(restored, 90), advanceDays(world, 90));
  for (const raw of [
    "no json",
    "{}",
    JSON.stringify({ ...world, date: "2026-02-30" }),
    JSON.stringify({ ...world, countries: [] }),
    JSON.stringify({ ...world, scientists: [{ id: "broken" }] }),
  ]) {
    assert.throws(() => loadGame(raw), /存档格式/);
  }
  const broken = structuredClone(world);
  broken.projects[0].templateId = "nonexistent";
  assert.throws(() => loadGame(JSON.stringify(broken)), /存档格式/);
  assert.throws(() => advanceDays(world, -1), /时间推进/);
  assert.ok(TECHNOLOGIES.length >= 10);
});

test("突破后允许更换外流团队，工程化不会因旧人员归属而永久锁死", () => {
  const world = advanceDays(createWorld("CN"), 365);
  const project = world.projects.find(
    (item) => item.status === "breakthrough",
  )!;
  const previous = world.scientists.find(
    (item) => item.id === project.scientists[0],
  )!;
  previous.country = "US";
  const replacement = world.scientists.find(
    (item) =>
      item.country === "US" &&
      item.field === project.field &&
      item.id !== previous.id,
  )!;
  replacement.country = "CN";
  assert.ok(commercialize(world, project.id).error);
  const reassigned = assignScientists(world, project.id, [replacement.id]);
  assert.equal(reassigned.error, undefined);
  assert.equal(commercialize(reassigned.world, project.id).error, undefined);
});

test("年度汇总字段缺失会被拒绝，国家固定元数据从规则资料恢复", () => {
  const world = advanceDays(createWorld("CN"), 365);
  const malformed = structuredClone(world);
  Reflect.deleteProperty(malformed.reports[0], "revenue");
  assert.throws(() => loadGame(JSON.stringify(malformed)), /存档格式/);
  const restored = loadGame(
    JSON.stringify({
      ...world,
      countries: world.countries.map((country) => ({
        ...country,
        name: null,
        coordinates: null,
        sourceIds: null,
      })),
    }),
  );
  assert.deepEqual(restored.countries[0].coordinates, COUNTRIES[0].coordinates);
  assert.equal(restored.countries[0].name, COUNTRIES[0].name);
});
