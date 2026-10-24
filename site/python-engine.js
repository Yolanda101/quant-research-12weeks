const LOAD_TIMEOUT_MS = 90_000;
const DEFAULT_RUN_TIMEOUT_MS = 15_000;

const emptyResult = (error) => ({ stdout: '', stderr: '', error, checks: [] });

export class PythonEngine {
  constructor({ onStatus } = {}) {
    this.onStatus = typeof onStatus === 'function' ? onStatus : () => {};
    this.state = 'idle';
    this._worker = null;
    this._ready = false;
    this._pending = null;
    this._nextId = 0;
  }

  async run(code, { checkCode = '', timeoutMs = DEFAULT_RUN_TIMEOUT_MS } = {}) {
    if (this._pending) throw new Error('已有代码在运行，请等待完成或点击停止。');
    if (typeof code !== 'string' || typeof checkCode !== 'string') {
      throw new TypeError('代码必须是文本。');
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new TypeError('运行时间上限必须大于零。');
    }

    return new Promise((resolve) => {
      this._pending = {
        id: ++this._nextId,
        code,
        checkCode,
        timeoutMs,
        resolve,
        timer: null,
      };
      if (this._ready && this._worker) {
        this._startRun();
        return;
      }
      this._status('loading', '正在加载 Python，首次打开需要下载运行环境。');
      this._pending.timer = setTimeout(() => {
        this._abort('Python 加载超时。请检查网络后重新运行。');
      }, LOAD_TIMEOUT_MS);
      try {
        const worker = new Worker(new URL('./python-worker.js', import.meta.url));
        this._worker = worker;
        worker.onmessage = ({ data }) => {
          if (this._worker !== worker) return;
          if (data?.type === 'ready') {
            this._ready = true;
            this._status('ready', 'Python 已就绪。');
            if (this._pending) this._startRun();
          } else if (data?.type === 'init-error') {
            this._abort(data.error || 'Python 加载失败。请检查网络后重新运行。');
          } else if (data?.type === 'packages' && data.id === this._pending?.id) {
            this._status('loading', '正在准备本题使用的计算工具。首次运行需要下载。');
          } else if (data?.type === 'started' && data.id === this._pending?.id) {
            const pending = this._pending;
            clearTimeout(pending.timer);
            this._status('running', '代码运行中。');
            pending.timer = setTimeout(() => this._abort('代码运行超时，已停止。请检查循环条件后重新运行。'), pending.timeoutMs);
          } else if (data?.type === 'result' && data.id === this._pending?.id) {
            this._finish(data.result);
          }
        };
        worker.onerror = (event) => {
          if (this._worker !== worker) return;
          event.preventDefault();
          this._abort('Python 运行环境发生错误。请重新运行。');
        };
        worker.onmessageerror = () => {
          if (this._worker === worker) this._abort('未能读取运行结果。请重新运行。');
        };
        worker.postMessage({ type: 'init' });
      } catch (error) {
        this._abort(`无法启动 Python。请通过网站地址打开本页。\n${error.message}`);
      }
    });
  }

  cancel() {
    this._terminate();
    this._settle(emptyResult('运行已停止。'));
    this._status('idle', '运行已停止，可以重新运行。');
  }

  _startRun() {
    const pending = this._pending;
    if (!pending || !this._worker) return;
    clearTimeout(pending.timer);
    this._status('loading', '正在准备代码。');
    pending.timer = setTimeout(() => {
      this._abort('计算工具加载超时。请检查网络后重新运行。');
    }, LOAD_TIMEOUT_MS);
    try {
      this._worker.postMessage({
        type: 'run',
        id: pending.id,
        code: pending.code,
        checkCode: pending.checkCode,
      });
    } catch (error) {
      this._abort(`代码未能开始运行。\n${error.message}`);
    }
  }

  _finish(result) {
    this._settle(result);
    this._status(result.error ? 'error' : 'ready', result.error ? '运行未完成，请查看错误信息。' : '运行完成。');
  }

  _abort(message) {
    this._terminate();
    this._settle(emptyResult(message));
    this._status('error', message.split('\n')[0]);
  }

  _settle(result) {
    if (!this._pending) return;
    const pending = this._pending;
    this._pending = null;
    clearTimeout(pending.timer);
    pending.resolve(result);
  }

  _terminate() {
    this._worker?.terminate();
    this._worker = null;
    this._ready = false;
  }

  _status(state, message) {
    this.state = state;
    try {
      this.onStatus({ state, message });
    } catch (error) {
      console.error('Python 状态显示失败。', error);
    }
  }
}
