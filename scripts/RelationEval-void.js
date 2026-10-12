// 绑定到人物类的整个“人物关系”Object；新版 void Function。
function transform(self, input) {
  if (input.type !== 'Object') throw new Error('请绑定到整个人物关系属性。');
  const people = world.get_class(self.classId), kinds = world.get_class('关系');
  const persons = people.instances(), relations = kinds.instances();
  const byPerson = new Map(persons.map(x => [x.name, x]));
  const byPersonId = new Map(persons.map(x => [x.id, x]));
  const byKind = new Map(relations.map(x => [x.name, x]));
  const byKindId = new Map(relations.map(x => [x.id, x]));
  const link = (file, name) => `[${name}](${file}#${encodeURIComponent(name)})`;
  const nameOf = text => {
    const m = String(text || '').match(/\]\([^#)]+#([^)]*)\)/);
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch { return null; }
  };
  const only = (items, predicate, label) => {
    const matches = items.filter(predicate);
    if (matches.length !== 1) throw new Error(`人物关系属性配置缺少唯一的${label}。`);
    return matches[0];
  };
  const personSchema = only(input.schema().children || [], s => s.repeatable && s.valueType === 'Object' && s.keyType === 'Class' && s.classId === people.id, '人物项');
  const relationSchema = only(personSchema.children || [], s => s.key === '关系' && s.valueType === 'Object', '关系对象');
  const kindSchema = only(relationSchema.children || [], s => s.repeatable && s.keyType === 'Class' && s.classId === kinds.id && s.valueType === 'Null', '可重复关系项');
  const storySchema = only(personSchema.children || [], s => s.key === '人物关系小故事' && s.valueType === 'Object', '人物关系小故事');

  const rules = new Map(), inverse = new Map();
  for (const kind of relations) {
    const pairs = new Map();
    try {
      for (const row of kind.get_member('关系推理').members()) {
        const second = byKind.get(nameOf(row.name));
        let result;
        try {
          const value = row.to_value();
          if (value.type === 'Class' && value.classId === kinds.id) result = byKindId.get(value.entityId);
        } catch {}
        result ||= byKind.get(nameOf(row.value()));
        if (!second || !result) continue;
        if (!pairs.has(second.id)) pairs.set(second.id, new Set());
        pairs.get(second.id).add(result.id);
      }
    } catch {}
    rules.set(kind.id, pairs);
    try {
      const value = kind.get_member('关系反推').to_value();
      if (value.type === 'Class' && value.classId === kinds.id && byKindId.has(value.entityId)) inverse.set(kind.id, value.entityId);
    } catch {}
  }

  const graph = new Map(persons.map(x => [x.id, new Map()]));
  const addEdge = (a, b, kind) => {
    if (!graph.get(a).has(b)) graph.get(a).set(b, new Set());
    graph.get(a).get(b).add(kind);
  };
  for (const person of persons) {
    let rows;
    try { rows = person.get_member('人物关系').to_value().members || []; } catch { continue; }
    for (const row of rows) {
      const other = byPerson.get(nameOf(row.key));
      if (!other || other.id === person.id || row.value.type !== 'Object') continue;
      const field = (row.value.members || []).find(x => x.schemaId === relationSchema.id || x.key === relationSchema.key);
      if (field?.value.type !== 'Object') continue;
      for (const member of field.value.members || []) {
        const kind = byKind.get(nameOf(member.key));
        if (!kind) continue;
        addEdge(person.id, other.id, kind.id);
        if (inverse.has(kind.id)) addEdge(other.id, person.id, inverse.get(kind.id));
      }
    }
  }

  // 每条路径不重复经过同一人物，防止“妈妈→儿子→妈妈”回路。
  const found = new Map(), queue = [{person:self.id, kind:null, seen:new Set([self.id])}];
  const limit = 25000;
  for (let i = 0; i < queue.length; i++) {
    const state = queue[i];
    for (const [other, direct] of graph.get(state.person) || []) {
      if (state.seen.has(other)) continue;
      for (const edgeKind of direct) {
        const derived = state.kind === null ? [edgeKind] : [...(rules.get(state.kind)?.get(edgeKind) || [])];
        for (const kind of derived) {
          if (!found.has(other)) found.set(other, new Set());
          found.get(other).add(kind);
          if (!rules.get(kind)?.size) continue;
          if (queue.length >= limit) throw new Error('关系路径超过 25000 个搜索状态，已停止且没有写入部分结果。');
          queue.push({person:other, kind, seen:new Set([...state.seen, other])});
        }
      }
    }
  }

  // 实时读取也包含此前生成的成员，用来保证重复运行不会重复追加。
  const existing = new Map();
  for (const row of self.get_member('人物关系').members()) {
    const person = byPerson.get(nameOf(row.name));
    if (!person) continue;
    if (!existing.has(person.id)) existing.set(person.id, {row, kinds:new Set()});
    const record = existing.get(person.id);
    try {
      for (const member of row.get_member(relationSchema.key).members()) {
        const kind = byKind.get(nameOf(member.name));
        if (kind) record.kinds.add(kind.id);
      }
    } catch {}
  }
  for (const [personId, types] of found) {
    const record = existing.get(personId);
    const missing = [...types].filter(id => !record?.kinds.has(id)).map(id => byKindId.get(id));
    if (!missing.length) continue;
    missing.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    if (record) {
      const list = record.row.get_member(relationSchema.key);
      for (const kind of missing) list.add(kindSchema.id, values.null(), link('关系类型.md', kind.name));
    } else {
      input.add(personSchema.id, values.object([
        {schemaId:relationSchema.id, key:relationSchema.key, value:values.object(missing.map(kind => ({
          schemaId:kindSchema.id, key:link('关系类型.md', kind.name), value:values.null()
        })))},
        {schemaId:storySchema.id, key:storySchema.key, value:values.object([])}
      ]), link('人物列表.md', byPersonId.get(personId).name));
    }
  }
}
