import copy

class TypedValues:
    def __init__(self, contract): self.contract = contract
    def text(self, value): return {'type': 'Text', 'value': value}
    def content(self, value): return {'type': 'Content', 'value': value}
    def integer(self, value): return {'type': 'Integer', 'value': value}
    def decimal(self, value): return {'type': 'Decimal', 'value': value}
    def date(self, value): return {'type': 'Data', 'value': value}
    def null(self): return {'type': 'Null', 'value': None}
    def reference(self, class_id, entity_id): return {'type': 'Class', 'classId': class_id, 'entityId': entity_id}
    def object(self, members, class_id=None):
        result = {'type': 'Object', 'members': [{'key': key, 'value': value} for key, value in members.items()] if isinstance(members, dict) else members}
        if class_id: result['classId'] = class_id
        return result

class TypedInput:
    def __init__(self, data, world):
        self.data, self.world = data, world
        self.type, self.classId, self.entityId = data['type'], data.get('classId'), data.get('entityId')
    def value(self):
        if self.type == 'Object': return self.data['members']
        if self.type == 'Class': return {'classId': self.classId, 'entityId': self.entityId}
        return self.data.get('value')
    def to_value(self): return copy.deepcopy(self.data)
    def instance(self):
        if self.type != 'Class': raise TypeError('只有 Class 值可读取实例')
        return self.world.get_class(self.classId).get_instance(self.entityId)
    def members(self):
        if self.type != 'Object': raise TypeError('只有 Object 值具有子成员')
        result = []
        for member in self.data['members']:
            item = TypedInput(member['value'], self.world)
            item.key, item.id, item.schemaId = member['key'], member.get('id'), member.get('schemaId')
            result.append(item)
        return result
    def get_member(self, key):
        matches = [m for m in self.data.get('members', []) if key in (m.get('id'), m.get('schemaId'), m['key'])]
        if len(matches) != 1: raise ValueError('属性不存在或重名，请使用 ID: ' + str(key))
        return TypedInput(matches[0]['value'], self.world)
    def markdown(self):
        if self.type == 'Null': return ''
        if self.type == 'Class': return self.instance().markdown()
        if self.type == 'Object': return '\n\n'.join('### ' + m['key'] + '\n\n' + TypedInput(m['value'], self.world).markdown() for m in self.data['members'])
        return str(self.value())
