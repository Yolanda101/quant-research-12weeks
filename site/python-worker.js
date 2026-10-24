/* Pyodide 0.27.7: https://pyodide.org/en/0.27.7/usage/quickstart.html */
const PYODIDE_BASE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
const OUTPUT_LIMIT = 20_000;
const ERROR_LIMIT = 12_000;
let runtimePromise;
let busy = false;

function limitedOutput() {
  let value = '';
  let truncated = false;
  const decoder = new TextDecoder();
  function append(text) {
    const remaining = OUTPUT_LIMIT - value.length;
    if (text.length > remaining) truncated = true;
    if (remaining > 0) value += text.slice(0, remaining);
  }
  return {
    write(buffer) {
      if (!truncated) append(decoder.decode(buffer, { stream: true }));
      return buffer.length;
    },
    text() {
      if (!truncated) append(decoder.decode());
      return value + (truncated ? '\n输出过长，后续内容已省略。' : '');
    },
  };
}

function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      importScripts(`${PYODIDE_BASE_URL}pyodide.js`);
      const pyodide = await loadPyodide({ indexURL: PYODIDE_BASE_URL });
      pyodide.setStdin({ stdin: () => null });
      return pyodide;
    })();
  }
  return runtimePromise;
}

function destroyProxy(value) {
  if (value && typeof value.destroy === 'function') value.destroy();
}

function parseChecks(value) {
  const converted = value?.toJs
    ? value.toJs({ dict_converter: Object.fromEntries, create_pyproxies: false })
    : value;
  if (!Array.isArray(converted)) throw new Error('检查脚本需要生成 checks 列表。');
  if (converted.length > 100) throw new Error('检查项目数量超过上限。');
  return converted.map((check) => {
    if (!check || typeof check.label !== 'string' || typeof check.passed !== 'boolean') {
      throw new Error('检查结果需要包含 label 文本和 passed 布尔值。');
    }
    const result = { label: check.label.slice(0, 200), passed: check.passed };
    if (check.detail != null) result.detail = String(check.detail).slice(0, 1000);
    return result;
  });
}

async function execute({ id, code, checkCode }) {
  if (busy) {
    self.postMessage({ type: 'result', id, result: {
      stdout: '', stderr: '', error: '已有代码在运行。', checks: [],
    } });
    return;
  }
  busy = true;
  const stdout = limitedOutput();
  const stderr = limitedOutput();
  const result = { stdout: '', stderr: '', error: null, checks: [] };
  let globals;
  let pyodide;
  let phase = 'student';
  try {
    pyodide = await loadRuntime();
    self.postMessage({ type: 'packages', id });
    await pyodide.loadPackagesFromImports(code);
    self.postMessage({ type: 'started', id });
    pyodide.runPython('import sys\nsys.stdout = sys.__stdout__\nsys.stderr = sys.__stderr__');
    pyodide.setStdout({ write: (buffer) => stdout.write(buffer) });
    pyodide.setStderr({ write: (buffer) => stderr.write(buffer) });
    globals = pyodide.toPy({ __name__: '__main__' });
    const value = await pyodide.runPythonAsync(code, { globals, filename: '练习.py' });
    destroyProxy(value);
    if (checkCode.trim()) {
      phase = 'check';
      if (globals.has('checks')) globals.delete('checks');
      const checkedValue = await pyodide.runPythonAsync(checkCode, { globals, filename: '检查.py' });
      destroyProxy(checkedValue);
      const checks = globals.get('checks');
      try {
        result.checks = parseChecks(checks);
      } finally {
        destroyProxy(checks);
      }
    }
  } catch (error) {
    const prefix = phase === 'check' ? '检查未完成，请查看错误信息。' : '代码未能完成，请根据末行提示修改。';
    result.error = `${prefix}\n${String(error.message || error).slice(0, ERROR_LIMIT)}`;
    result.checks = [];
  } finally {
    if (pyodide) {
      try {
        pyodide.runPython('import sys\nsys.stdout.flush()\nsys.stderr.flush()');
      } catch (_) {
        // Preserve the original execution error when a stream has been closed.
      }
    }
    destroyProxy(globals);
    result.stdout = stdout.text();
    result.stderr = stderr.text();
    busy = false;
    self.postMessage({ type: 'result', id, result });
  }
}

self.onmessage = async ({ data }) => {
  if (data?.type === 'init') {
    try {
      await loadRuntime();
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'init-error', error:
        `Python 加载失败。请检查网络后重新运行。\n${String(error.message || error).slice(0, 1500)}`,
      });
    }
  } else if (data?.type === 'run') {
    await execute(data);
  }
};
