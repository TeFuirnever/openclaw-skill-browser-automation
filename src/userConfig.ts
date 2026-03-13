import fs from 'node:fs';
import path from 'node:path';
import * as os from 'os';

function getUserConfigPath(): string {
  return path.join(os.homedir(), '.config', 'mcp-playwright-server', 'allowed-domains.json');
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase();
}

interface UserConfig {
  allowedDomains: string[];
}

export interface BrowserConfig {
  headless?: boolean;
  devtools?: boolean;
}

interface UserConfigData {
  allowedDomains?: string[];
  browser?: BrowserConfig;
}

function loadUserConfig(): UserConfigData {
  const configPath = getUserConfigPath();

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw) as UserConfigData;
  } catch {
    return {};
  }
}

function loadUserDomains(): string[] {
  const config = loadUserConfig();

  if (!Array.isArray(config.allowedDomains)) {
    return [];
  }

  return config.allowedDomains
    .filter((v): v is string => typeof v === 'string')
    .map(v => normalizeDomain(v))
    .filter(v => v.length > 0);
}

export function getBrowserConfig(): BrowserConfig {
  const config = loadUserConfig();
  return config.browser ?? {};
}

function saveUserDomains(domains: string[]): void {
  const configPath = getUserConfigPath();
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const config: UserConfig = { allowedDomains: domains };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

export function addUserDomain(domain: string): { added: boolean; domains: string[] } {
  const normalized = normalizeDomain(domain);
  const currentDomains = loadUserDomains();

  if (currentDomains.includes(normalized)) {
    return { added: false, domains: currentDomains };
  }

  const newDomains = [...currentDomains, normalized];
  saveUserDomains(newDomains);

  return { added: true, domains: newDomains };
}

export function removeUserDomain(domain: string): { removed: boolean; domains: string[] } {
  const normalized = normalizeDomain(domain);
  const currentDomains = loadUserDomains();

  if (!currentDomains.includes(normalized)) {
    return { removed: false, domains: currentDomains };
  }

  const newDomains = currentDomains.filter(d => d !== normalized);
  saveUserDomains(newDomains);

  return { removed: true, domains: newDomains };
}

export function listUserDomains(): string[] {
  return loadUserDomains();
}
