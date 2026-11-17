/** Sequential, fail-fast release checks. This command never publishes anything. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { projectRoot } from './check-versions.mjs';

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: projectRoot, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code, signal) => signal ? reject(new Error(`进程被信号 ${signal} 终止`)) : resolve(code ?? 1));
  });
}

export async function runChecks(steps, run = runNode, log = console.log) {
  for (const [index, step] of steps.entries()) {
    const label = `[${index + 1}/${steps.length}] ${step.name}`;
    log(`\n${label}`);
    let code;
    try { code = await run(step.args); }
    catch (error) { log(`FAIL ${label}：${error.message}`); return 1; }
    if (code === 2 && step.networkCheck) {
      log(`INCOMPLETE ${label}：线上网络验证未完成；恢复网络后重跑。退出码 2。`);
      return 2;
    }
    if (code !== 0) { log(`FAIL ${label}：退出码 ${code}，已停止后续检查。`); return 1; }
    log(`PASS ${label}`);
  }
  log('\n自动发布前检查通过。Edge 原生交互及 Partner Center 核对仍由人工完成；本命令不发布扩展。');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const tests = (await fs.readdir(path.join(projectRoot, 'tests'))).filter(name => name.endsWith('.test.mjs')).sort().map(name => `tests/${name}`);
    process.exitCode = await runChecks([
      { name: '版本一致性', args: ['tools/check-versions.mjs'] },
      { name: '单元与核心回归测试', args: ['--test', ...tests] },
      { name: '生成扩展安装包', args: ['tools/pack.mjs'] },
      { name: '安装包与源码逐字节校验', args: ['tools/verify-package.mjs'] },
      { name: '商店材料与线上隐私页验证', args: ['tools/store-verify.mjs'], networkCheck: true }
    ]);
  } catch (error) { console.error(`发布前检查无法启动：${error.message}`); process.exitCode = 1; }
}
