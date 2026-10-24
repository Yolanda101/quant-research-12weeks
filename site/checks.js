// Web 和本地检查使用相同的 Python 脚本。
export function buildCheck(expected, {answers=false}={}) {
 const specification=JSON.stringify(expected);
 return `
import json as _check_json
import math as _check_math
import numbers as _check_numbers

def _check_plain(value):
    if hasattr(value, 'tolist'):
        value = value.tolist()
    if isinstance(value, dict):
        return {str(k): _check_plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_check_plain(v) for v in value]
    return value

def _check_equal(actual, expected):
    actual = _check_plain(actual)
    if isinstance(expected, bool):
        return isinstance(actual, bool) and actual == expected
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        if isinstance(actual, bool) or not isinstance(actual, _check_numbers.Real):
            return False
        try:
            return _check_math.isfinite(actual) and abs(actual - expected) < 1e-8
        except (OverflowError, TypeError, ValueError):
            return False
    if isinstance(expected, list):
        return isinstance(actual, list) and len(actual) == len(expected) and all(_check_equal(a,b) for a,b in zip(actual,expected))
    if isinstance(expected, dict):
        return isinstance(actual, dict) and actual.keys() == expected.keys() and all(_check_equal(actual[k],v) for k,v in expected.items())
    return actual == expected

_check_specification = _check_json.loads(${JSON.stringify(specification)})
checks = []
for _check_item in _check_specification:
    _check_actual = globals().get(_check_item['name'])
    checks.append({'label':_check_item['label'],'passed':bool(_check_equal(_check_actual,_check_item['value'])),'detail':'期望值：'+str(_check_item['value'])+'，实际值：'+str(_check_actual)})
${answers ? `_check_answers=globals().get('answers')
checks.append({'label':'三段文字解释已填写','passed':isinstance(_check_answers,list) and len(_check_answers)==3 and all(isinstance(v,str) and bool(v.strip()) for v in _check_answers),'detail':'解释内容需要人工审阅'})` : ''}
`;
}
