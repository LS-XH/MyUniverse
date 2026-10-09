// Function v2: bind to 人物 -> 人物关系 -> one repeatable 人物 item (Object).
// Set the return type to Object and leave the return class specification empty.
// The item key identifies the target person; its 关系 value is a relation Class reference.

function transform(self, input) {
  if (input.type !== 'Object') {
    throw new Error('请将函数绑定到“人物关系”下的单个人物关系项（Object）。');
  }

  const peopleClass = world.get_class(self.classId);
  const relationClass = world.get_class('关系');
  const people = peopleClass.instances();
  const relations = relationClass.instances();
  const peopleByName = new Map(people.map(person => [person.name, person]));
  const relationByName = new Map(relations.map(relation => [relation.name, relation]));
  const relationById = new Map(relations.map(relation => [relation.id, relation]));

  function linkedName(text) {
    const match = String(text || '').match(/\]\([^#)]+#([^)]*)\)/);
    if (!match) return null;
    try { return decodeURIComponent(match[1]); } catch { return null; }
  }

  function rowChildren(row) {
    try { return row.members(); } catch { return []; }
  }

  // input contains child field IDs, while its own Class key is on the parent row.
  // Match IDs instead of matching the relation text, which may repeat on other rows.
  const inputIds = new Set((input.to_value().members || []).map(member => member.id).filter(Boolean));
  if (!inputIds.size) {
    throw new Error('当前关系项缺少子属性 ID；请从人物列表中的实际关系项运行，而非手写测试 input。');
  }
  const ownRows = self.get_member('人物关系').members();
  const matchingRows = ownRows.filter(row => rowChildren(row).some(member => inputIds.has(member.id)));
  if (matchingRows.length !== 1) {
    throw new Error('无法唯一定位当前人物关系项；请检查所绑定的属性和测试 input。');
  }
  const targetName = linkedName(matchingRows[0].name);
  const target = targetName && peopleByName.get(targetName);
  if (!target) throw new Error('当前关系项的键不是有效的人物引用。');
  if (target.id === self.id) throw new Error('当前人物与关系项的目标人物不能相同。');

  // A relation's 关系推理 rows mean: first relation + row key = row value.
  // Multiple rules for the same pair are retained.
  const inference = new Map();
  for (const relation of relations) {
    let ruleRows;
    try { ruleRows = relation.get_member('关系推理').members(); } catch { continue; }
    const bySecond = new Map();
    for (const rule of ruleRows) {
      const second = relationByName.get(linkedName(rule.name));
      const result = relationByName.get(linkedName(rule.value()));
      if (!second || !result) continue;
      if (!bySecond.has(second.id)) bySecond.set(second.id, new Set());
      bySecond.get(second.id).add(result.id);
    }
    inference.set(relation.id, bySecond);
  }

  const graph = new Map();
  for (const person of people) {
    const edges = [];
    let rows;
    try { rows = person.get_member('人物关系').members(); } catch { rows = []; }
    for (const row of rows) {
      const next = peopleByName.get(linkedName(row.name));
      if (!next) continue;
      let relationValue;
      try { relationValue = row.get_member('关系').to_value(); } catch { continue; }
      if (relationValue.type !== 'Class' || relationValue.classId !== relationClass.id ||
          !relationById.has(relationValue.entityId)) continue;
      edges.push({ personId: next.id, relationId: relationValue.entityId });
    }
    graph.set(person.id, edges);
  }

  // Enumerate simple person paths. A path never revisits a person, so loops such
  // as 妈妈 -> 儿子 -> 妈妈 terminate. Rule-less paths terminate immediately.
  const found = new Set();
  const queue = [{ personId: self.id, relationId: null, visited: new Set([self.id]) }];
  const MAX_STATES = 25000;
  for (let head = 0; head < queue.length; head++) {
    if (head >= MAX_STATES) {
      throw new Error('人物关系路径超过 25000 个搜索状态；请减少关系回路或拆分关系网。');
    }
    const state = queue[head];
    for (const edge of graph.get(state.personId) || []) {
      if (state.visited.has(edge.personId)) continue;
      const nextRelations = state.relationId === null
        ? [edge.relationId]
        : [...(inference.get(state.relationId)?.get(edge.relationId) || [])];
      for (const nextRelation of nextRelations) {
        if (edge.personId === target.id) {
          found.add(nextRelation);
        } else if (inference.get(nextRelation)?.size) {
          if (queue.length >= MAX_STATES) {
            throw new Error('人物关系路径超过 25000 个搜索状态；请减少关系回路或拆分关系网。');
          }
          queue.push({
            personId: edge.personId,
            relationId: nextRelation,
            visited: new Set([...state.visited, edge.personId])
          });
        }
      }
    }
  }

  return values.object([...found]
    .map(id => relationById.get(id))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .map(relation => ({
      key: `[${relation.name}](关系类型.md#${encodeURIComponent(relation.name)})`,
      value: values.null()
    })));
}
