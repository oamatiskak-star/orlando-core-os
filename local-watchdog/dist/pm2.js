"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPM2Apps = listPM2Apps;
exports.restartApp = restartApp;
exports.stopApp = stopApp;
exports.startApp = startApp;
exports.tailErrorLog = tailErrorLog;
exports.rebuildApp = rebuildApp;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = require("fs");
const path_1 = require("path");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const PM2_BIN = process.env.PM2_BIN || 'pm2';
async function run(cmd, timeoutMs = 30_000) {
    return execAsync(cmd, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });
}
async function listPM2Apps() {
    const { stdout } = await run(`${PM2_BIN} jlist`);
    const trimmed = stdout.trim();
    if (!trimmed)
        return [];
    return JSON.parse(trimmed);
}
async function restartApp(name) {
    await run(`${PM2_BIN} restart ${shellEscape(name)} --update-env`);
}
async function stopApp(name) {
    await run(`${PM2_BIN} stop ${shellEscape(name)}`);
}
async function startApp(name) {
    await run(`${PM2_BIN} start ${shellEscape(name)}`);
}
async function tailErrorLog(app, lines = 60) {
    const path = app.pm2_env.pm_err_log_path;
    if (!path || !(0, fs_1.existsSync)(path))
        return '';
    try {
        const { stdout } = await run(`tail -n ${lines} ${shellEscape(path)}`);
        return stdout;
    }
    catch {
        return '';
    }
}
async function rebuildApp(app) {
    const cwd = app.pm2_env.pm_cwd || app.pm2_env.cwd;
    if (!cwd)
        return { ran: false, log: 'no cwd available' };
    const pkgPath = (0, path_1.join)(cwd, 'package.json');
    if (!(0, fs_1.existsSync)(pkgPath))
        return { ran: false, log: `no package.json in ${cwd}` };
    let pkg;
    try {
        pkg = JSON.parse((0, fs_1.readFileSync)(pkgPath, 'utf-8'));
    }
    catch (err) {
        return { ran: false, log: `failed to parse package.json: ${err instanceof Error ? err.message : err}` };
    }
    const hasBuild = !!pkg.scripts?.build;
    const steps = [];
    try {
        steps.push(`cd ${shellEscape(cwd)}`);
        steps.push('npm install --no-audit --no-fund');
        if (hasBuild)
            steps.push('npm run build');
        const cmd = steps.join(' && ');
        const { stdout, stderr } = await run(cmd, 5 * 60 * 1000);
        return { ran: true, log: `cwd=${cwd}\nsteps=${steps.join(' && ')}\n--- stdout ---\n${stdout.slice(-2000)}\n--- stderr ---\n${stderr.slice(-2000)}` };
    }
    catch (err) {
        const e = err;
        return {
            ran: true,
            log: `cwd=${cwd}\nsteps=${steps.join(' && ')}\n--- stdout ---\n${(e.stdout ?? '').slice(-2000)}\n--- stderr ---\n${(e.stderr ?? '').slice(-2000)}`,
            error: e.message ?? String(err)
        };
    }
}
function shellEscape(s) {
    if (/^[A-Za-z0-9_\-./:=]+$/.test(s))
        return s;
    return `'${s.replace(/'/g, `'\\''`)}'`;
}
