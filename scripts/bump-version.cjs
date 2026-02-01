#!/usr/bin/env node
// Tauri 2 版本管理脚本 - 同步 package.json 和 Cargo.toml
// tauri.conf.json 使用 "../package.json" 引用，无需手动更新

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const packageJsonPath = path.join(root, 'package.json');
const cargoTomlPath = path.join(root, 'src-tauri/Cargo.toml');

// 读取当前版本
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

// 解析参数
const args = process.argv.slice(2);
const bumpArg = args.find(arg => !arg.startsWith('--'));
const noGit = args.includes('--no-git');
const dryRun = args.includes('--dry-run');

if (!bumpArg) {
  console.log(`当前版本: ${currentVersion}\n`);
  console.log('用法: pnpm bump <patch|minor|major|snapshot|x.y.z> [options]');
  console.log('\n选项:');
  console.log('  patch        递增补丁版本 (0.0.3 → 0.0.4)');
  console.log('  minor        递增次版本 (0.0.3 → 0.1.0)');
  console.log('  major        递增主版本 (0.0.3 → 1.0.0)');
  console.log('  snapshot     快照版本 (0.0.3 → 0.0.4-26032)');
  console.log('  x.y.z        设置指定版本');
  console.log('\n标志:');
  console.log('  --no-git     跳过 git commit 和 tag');
  console.log('  --dry-run    预览更改，不实际修改文件');
  process.exit(0);
}

let newVersion;

switch (bumpArg) {
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  case 'snapshot': {
    // MSI requires pre-release identifiers to be numeric-only and <= 65535.
    // Use a compact date code: (year % 100) * 1000 + dayOfYear (max ~65366).
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now - startOfYear) / 86400000) + 1;
    const compactDate = (now.getFullYear() % 100) * 1000 + dayOfYear;
    newVersion = `${major}.${minor}.${patch + 1}-${compactDate}`;
    break;
  }
  default:
    if (/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(bumpArg)) {
      newVersion = bumpArg;
    } else {
      console.error('错误: 使用 patch/minor/major/snapshot 或 SemVer 格式 (如 1.0.0, 1.0.0-beta.1)');
      process.exit(1);
    }
}

if (newVersion === currentVersion) {
  console.log(`版本已经是 ${currentVersion}`);
  process.exit(0);
}

console.log(`\n版本升级: ${currentVersion} → ${newVersion}\n`);

if (dryRun) {
  console.log('[dry-run] 将更新以下文件:');
  console.log('  - package.json');
  console.log('  - src-tauri/Cargo.toml');
  console.log('  - src-tauri/Cargo.lock');
  console.log('  - tauri.conf.json (自动继承 package.json)');
  if (!noGit) {
    console.log(`  - git commit: "chore: bump version to ${newVersion}"`);
    console.log(`  - git tag: v${newVersion}`);
  }
  process.exit(0);
}

// 更新 package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log(`✓ package.json: ${currentVersion} → ${newVersion}`);

// 更新 Cargo.toml
let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
cargoToml = cargoToml.replace(/^version = "[^"]+"$/m, `version = "${newVersion}"`);
fs.writeFileSync(cargoTomlPath, cargoToml);
console.log(`✓ Cargo.toml: ${currentVersion} → ${newVersion}`);

// 更新 Cargo.lock
try {
  execSync('cargo update -p claude-code-impact --quiet', { cwd: path.join(root, 'src-tauri'), stdio: 'pipe' });
  console.log(`✓ Cargo.lock: 已同步`);
} catch (e) {
  // 包名可能不同，尝试不指定包名
  try {
    execSync('cargo check --quiet', { cwd: path.join(root, 'src-tauri'), stdio: 'pipe' });
    console.log(`✓ Cargo.lock: 已同步`);
  } catch {
    console.log(`⚠ Cargo.lock: 无法自动更新，请手动运行 cargo build`);
  }
}

console.log(`✓ tauri.conf.json: 自动继承 package.json 版本`);

// Git commit 和 tag
if (!noGit) {
  try {
    execSync('git add package.json src-tauri/Cargo.toml src-tauri/Cargo.lock', { cwd: root, stdio: 'pipe' });
    execSync(`git commit -m "chore: bump version to ${newVersion}"`, { cwd: root, stdio: 'pipe' });
    execSync(`git tag v${newVersion}`, { cwd: root, stdio: 'pipe' });
    console.log(`✓ Git commit + tag v${newVersion}`);
    console.log(`\n下一步: git push origin main --tags`);
  } catch (e) {
    console.error('Git 操作失败:', e.message);
  }
}

console.log('\n版本更新完成!');
