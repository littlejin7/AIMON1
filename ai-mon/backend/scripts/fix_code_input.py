import os, json

data_dir = r'c:\AIMON\AIMON1\ai-mon\backend\data'
for root, dirs, files in os.walk(data_dir):
    for f in files:
        if f.endswith('.json'):
            path = os.path.join(root, f)
            try:
                with open(path, 'r', encoding='utf-8') as f_in:
                    data = json.load(f_in)
                
                changed = False
                for q in data:
                    if q.get('type') == 'code_input':
                        choices = q.get('choices', [])
                        if len(choices) <= 1:
                            print(f"File: {path}, Question: {q.get('question_id')}")
                            # Give dummy choices based on answer
                            ans = q.get('answer', '')
                            if isinstance(ans, list):
                                ans = ans[0] if ans else ''
                            
                            distractors = []
                            if ans == 'post': distractors = ['get', 'put', 'delete']
                            elif ans == 'get': distractors = ['post', 'fetch', 'request']
                            elif ans == 'put': distractors = ['patch', 'post', 'update']
                            elif ans == 'True': distractors = ['False', 'None', '0']
                            elif ans == 'False': distractors = ['True', 'None', '0']
                            elif ans == 'int': distractors = ['str', 'float', 'bool']
                            elif ans == 'str': distractors = ['int', 'char', 'text']
                            elif ans == 'dict': distractors = ['list', 'tuple', 'set']
                            elif ans == 'list': distractors = ['dict', 'array', 'tuple']
                            elif ans == 'return': distractors = ['yield', 'await', 'break']
                            elif ans == 'await': distractors = ['yield', 'return', 'async']
                            elif ans == 'async': distractors = ['await', 'sync', 'def']
                            elif ans == 'yield': distractors = ['return', 'await', 'continue']
                            elif ans == 'self': distractors = ['cls', 'this', 'super']
                            elif ans == 'cls': distractors = ['self', 'class', 'super']
                            elif ans == 'None': distractors = ['Null', 'False', '0']
                            elif ans == 'len': distractors = ['size', 'count', 'length']
                            elif ans == 'append': distractors = ['add', 'insert', 'push']
                            elif ans == 'extend': distractors = ['append', 'merge', 'add']
                            elif ans == 'pop': distractors = ['remove', 'delete', 'drop']
                            elif ans == 'remove': distractors = ['pop', 'delete', 'discard']
                            elif ans == 'format': distractors = ['f', 'replace', 'join']
                            elif ans == 'join': distractors = ['split', 'concat', 'merge']
                            elif ans == 'split': distractors = ['join', 'slice', 'cut']
                            elif ans == 'map': distractors = ['filter', 'reduce', 'apply']
                            elif ans == 'filter': distractors = ['map', 'select', 'find']
                            elif ans == '__init__': distractors = ['__new__', '__start__', '__main__']
                            elif ans == '__main__': distractors = ['__init__', '__name__', '__start__']
                            elif ans == 'import': distractors = ['include', 'require', 'using']
                            elif ans == 'from': distractors = ['import', 'where', 'select']
                            elif ans == 'as': distractors = ['alias', 'like', 'is']
                            elif ans == 'def': distractors = ['func', 'function', 'define']
                            elif ans == 'class': distractors = ['struct', 'object', 'type']
                            elif ans == 'pass': distractors = ['continue', 'break', 'return']
                            elif ans == 'continue': distractors = ['pass', 'break', 'next']
                            elif ans == 'break': distractors = ['continue', 'stop', 'exit']
                            elif ans == 'in': distractors = ['has', 'contains', 'of']
                            elif ans == 'is': distractors = ['==', 'equals', 'match']
                            elif ans == 'and': distractors = ['&&', 'or', 'not']
                            elif ans == 'or': distractors = ['||', 'and', 'not']
                            elif ans == 'not': distractors = ['!', 'no', 'is']
                            elif ans == 'except': distractors = ['catch', 'error', 'finally']
                            elif ans == 'finally': distractors = ['except', 'always', 'end']
                            elif ans == 'raise': distractors = ['throw', 'except', 'error']
                            elif ans == 'with': distractors = ['using', 'open', 'as']
                            elif ans == 'lambda': distractors = ['def', 'anon', 'func']
                            elif ans == 'global': distractors = ['nonlocal', 'local', 'static']
                            elif ans == 'nonlocal': distractors = ['global', 'local', 'outer']
                            elif ans == 'open': distractors = ['read', 'file', 'load']
                            elif ans == 'read': distractors = ['open', 'load', 'get']
                            elif ans == 'write': distractors = ['save', 'put', 'print']
                            elif ans == 'print': distractors = ['echo', 'log', 'write']
                            elif ans == 'input': distractors = ['read', 'get', 'scan']
                            elif ans == 'type': distractors = ['class', 'isinstance', 'typeof']
                            elif ans == 'isinstance': distractors = ['type', 'issubclass', 'typeof']
                            elif ans == 'super': distractors = ['parent', 'base', 'self']
                            elif ans == 'set': distractors = ['dict', 'list', 'hash']
                            elif ans == 'tuple': distractors = ['list', 'dict', 'array']
                            elif ans == 'zip': distractors = ['map', 'combine', 'merge']
                            elif ans == 'enumerate': distractors = ['count', 'range', 'zip']
                            elif ans == 'range': distractors = ['xrange', 'list', 'enumerate']
                            elif ans == 'sum': distractors = ['add', 'total', 'count']
                            elif ans == 'max': distractors = ['min', 'largest', 'top']
                            elif ans == 'min': distractors = ['max', 'smallest', 'bottom']
                            elif ans == 'any': distractors = ['all', 'some', 'exists']
                            elif ans == 'all': distractors = ['any', 'every', 'each']
                            elif ans == 'sorted': distractors = ['sort', 'order', 'arrange']
                            elif ans == 'reversed': distractors = ['reverse', 'backwards', 'flip']
                            elif ans == 'locals': distractors = ['globals', 'vars', 'dir']
                            elif ans == 'globals': distractors = ['locals', 'vars', 'dir']
                            elif ans == 'dir': distractors = ['locals', 'globals', 'vars']
                            elif ans == 'vars': distractors = ['locals', 'globals', 'dir']
                            elif ans == 'getattr': distractors = ['setattr', 'hasattr', 'delattr']
                            elif ans == 'setattr': distractors = ['getattr', 'hasattr', 'delattr']
                            elif ans == 'hasattr': distractors = ['getattr', 'setattr', 'delattr']
                            elif ans == 'delattr': distractors = ['getattr', 'setattr', 'hasattr']
                            elif ans == 'staticmethod': distractors = ['classmethod', 'property', 'instancemethod']
                            elif ans == 'classmethod': distractors = ['staticmethod', 'property', 'instancemethod']
                            elif ans == 'property': distractors = ['attribute', 'field', 'staticmethod']
                            else: distractors = ['dummy1', 'dummy2', 'dummy3']

                            q['choices'] = [ans] + distractors
                            changed = True

                if changed:
                    with open(path, 'w', encoding='utf-8') as f_out:
                        json.dump(data, f_out, ensure_ascii=False, indent=2)
                    print(f"Updated {path}")
            except Exception as e:
                print(f"Error reading {path}: {e}")
