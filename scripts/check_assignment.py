#!/usr/bin/env python3
"""运行并检查前四周的 Python 或 Notebook 作业。"""

import argparse
import json
import math
import os
from pathlib import Path
import statistics
import re
import subprocess
import sys
import tempfile


TIMEOUT_SECONDS = 10
VARIABLES = (
    "returns", "cumulative_return", "mean_return", "median_return",
    "net_profit", "answers",
)
EXPECTED_RETURNS = [0.1, -0.1, 108 / 99 - 1, 105 / 108 - 1]
EXPECTED = {
    "returns": EXPECTED_RETURNS,
    "cumulative_return": 0.05,
    "mean_return": sum(EXPECTED_RETURNS) / len(EXPECTED_RETURNS),
    "median_return": statistics.median(EXPECTED_RETURNS),
    "net_profit": 979.0,
}

# 子进程将作业变量写入临时文件，作业自己的 print 输出不会干扰结果。
RUNNER = """
import json
from pathlib import Path
import runpy
import sys

namespace = runpy.run_path(sys.argv[1], run_name="__main__")
names = ["returns", "cumulative_return", "mean_return", "median_return", "net_profit", "answers"]

def plain(value):
    if value is None or isinstance(value, (str, bool, int, float)):
        return value
    if isinstance(value, list):
        return [plain(item) for item in value]
    return {"unsupported_type": type(value).__name__}

values = {name: plain(namespace.get(name)) for name in names}
Path(sys.argv[2]).write_text(json.dumps(values, ensure_ascii=False), encoding="utf-8")
"""


def load_code(path):
    if path.suffix == ".py":
        return path.read_text(encoding="utf-8-sig")
    if path.suffix != ".ipynb":
        raise ValueError("请选择 .py 或 .ipynb 作业文件。")
    notebook = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(notebook, dict) or not isinstance(notebook.get("cells"), list):
        raise ValueError("Notebook 缺少 cells 列表。")
    blocks = []
    for index, cell in enumerate(notebook["cells"], start=1):
        if cell.get("cell_type") != "code":
            continue
        source = cell.get("source", "")
        if isinstance(source, list):
            source = "".join(source)
        if not isinstance(source, str):
            raise ValueError(f"第 {index} 个单元的代码格式有误。")
        blocks.append(f"# Notebook 单元 {index}\n{source}\n")
    if not blocks:
        raise ValueError("Notebook 中没有代码单元。")
    return "\n".join(blocks)


def is_number(value):
    if isinstance(value, bool):
        return False
    return isinstance(value, int) or isinstance(value, float) and math.isfinite(value)


def same_number(actual, expected):
    if not is_number(actual):
        return False
    try:
        return abs(actual - expected) < 1e-8
    except OverflowError:
        return False


def check_values(values):
    checks = []
    for name, expected in EXPECTED.items():
        actual = values.get(name)
        if isinstance(expected, list):
            passed = isinstance(actual, list) and len(actual) == len(expected)
            passed = passed and all(same_number(a, e) for a, e in zip(actual, expected))
        else:
            passed = same_number(actual, expected)
        checks.append({"variable": name, "passed": passed, "actual": actual, "expected": expected})
    answers = values.get("answers")
    passed = isinstance(answers, list) and len(answers) == 3
    passed = passed and all(isinstance(item, str) and bool(item.strip()) for item in answers)
    checks.append({
        "variable": "answers", "passed": passed, "actual": answers,
        "expected": "包含三条非空文字解释的列表。内容由教师阅读确认。",
    })
    return checks


MULTI_RUNNER = """
import json
from pathlib import Path
import runpy
import sys

namespace=runpy.run_path(sys.argv[1],run_name="__main__")
exec(compile(Path(sys.argv[3]).read_text(encoding="utf-8"),"检查.py","exec"),namespace)

def plain(value):
    if hasattr(value,"tolist"):
        value=value.tolist()
    if value is None or isinstance(value,(str,bool,int,float)):
        return value
    if isinstance(value,list):
        return [plain(v) for v in value]
    if isinstance(value,dict):
        return {str(k):plain(v) for k,v in value.items()}
    return str(value)

Path(sys.argv[2]).write_text(json.dumps(plain(namespace["checks"]),ensure_ascii=False),encoding="utf-8")
"""


def evaluate(path, week=None, legacy=False):
    path=Path(path)
    result={"file":str(path),"passed":False,"checks":[],"error":None}
    try:
        if week is None:
            match=re.search(r"week0?([1-4])(?:\b|_)",str(path))
            week=int(match.group(1)) if match else 1
        week=int(week)
        if week not in range(1,5):
            raise ValueError("周次应为 1、2、3 或 4。")
        rubric=None
        if not legacy or week>1:
            rubric_path=Path(__file__).resolve().parents[1]/"assignments"/f"week{week:02d}-rubric.json"
            if not rubric_path.exists():
                raise ValueError("缺少作业检查文件，请先运行 npm run prepare。")
            rubric=json.loads(rubric_path.read_text(encoding="utf-8"))
        code=load_code(path)
        with tempfile.TemporaryDirectory(prefix=f"quant-week{week:02d}-") as folder:
            folder=Path(folder)
            code_path,output_path,runner_path=folder/"submission.py",folder/"result.json",folder/"runner.py"
            code_path.write_text(code,encoding="utf-8")
            runner_path.write_text(MULTI_RUNNER if rubric else RUNNER,encoding="utf-8")
            arguments=[sys.executable,"-I",str(runner_path),str(code_path),str(output_path)]
            if rubric:
                check_path=folder/"check.py"
                check_path.write_text(rubric["check"],encoding="utf-8")
                arguments.append(str(check_path))
            environment={key:value for key,value in os.environ.items() if key in {
                "PATH","SYSTEMROOT","WINDIR","LANG","LC_ALL","TMPDIR","TEMP","TMP",
            }}
            process=subprocess.run(arguments,cwd=folder,env=environment,capture_output=True,text=True,
                encoding="utf-8",errors="replace",timeout=TIMEOUT_SECONDS)
            if process.returncode!=0:
                message=process.stderr.strip() or process.stdout.strip() or "程序提前结束。"
                result["error"]="代码运行失败：\n"+message[-1800:]
                return result
            if not output_path.exists():
                result["error"]="代码提前结束，未能读取作业变量。"
                return result
            values=json.loads(output_path.read_text(encoding="utf-8"))
            if rubric:
                names=[item["name"] for item in rubric["expected"]]+["answers"]
                result["checks"]=[{"variable":names[i],"passed":item["passed"],"actual":item.get("detail",""),"expected":rubric["expected"][i]["value"] if i<len(rubric["expected"]) else "三条非空文字解释"} for i,item in enumerate(values)]
            else:
                result["checks"]=check_values(values)
            result["passed"]=all(item["passed"] for item in result["checks"])
    except subprocess.TimeoutExpired:
        result["error"]=f"代码运行超过 {TIMEOUT_SECONDS} 秒，请检查循环是否能够结束。"
    except (OSError,ValueError,TypeError,AttributeError) as error:
        result["error"]=str(error)
    return result


def main():
    parser = argparse.ArgumentParser(description="检查前四周作业。")
    parser.add_argument("path", type=Path, help="作业文件路径，支持 .py 和 .ipynb。")
    parser.add_argument("--json", action="store_true", help="输出 JSON 检查结果。")
    parser.add_argument("--week", type=int, choices=range(1,5), help="周次。文件名包含 week01 至 week04 时可省略。")
    args = parser.parse_args()
    result = evaluate(args.path, args.week)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"作业：{result['file']}")
        if result["error"]:
            print(result["error"])
        for item in result["checks"]:
            state = "通过" if item["passed"] else "待修改"
            print(f"{state} · {item['variable']}")
            print(f"  实际：{item['actual']}")
            print(f"  期望：{item['expected']}")
        print("数值检查通过，文字解释待教师阅读。" if result["passed"] else "作业尚未通过，请按上面的结果修改。")
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())

