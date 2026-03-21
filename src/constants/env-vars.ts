export type EnvVarGroupId =
  | "auth"
  | "models"
  | "runtime"
  | "network"
  | "mcp"
  | "plugins"
  | "privacy"
  | "advanced"
  | "custom";

export interface EnvVarSuggestion {
  key: string;
  desc: string;
  group: Exclude<EnvVarGroupId, "custom">;
  featured?: boolean;
  placeholder?: string;
  quickValues?: readonly string[];
}

export interface EnvVarGroupDefinition {
  id: Exclude<EnvVarGroupId, "custom">;
  labelKey: string;
  descriptionKey: string;
}

type EnvVarSuggestionSeed = Pick<EnvVarSuggestion, "key" | "desc">;
type EnvVarSuggestionOverride = Partial<Omit<EnvVarSuggestion, "key" | "desc">>;

export const ENV_VAR_GROUPS: EnvVarGroupDefinition[] = [
  {
    id: "auth",
    labelKey: "env.groups.auth.title",
    descriptionKey: "env.groups.auth.desc",
  },
  {
    id: "models",
    labelKey: "env.groups.models.title",
    descriptionKey: "env.groups.models.desc",
  },
  {
    id: "runtime",
    labelKey: "env.groups.runtime.title",
    descriptionKey: "env.groups.runtime.desc",
  },
  {
    id: "network",
    labelKey: "env.groups.network.title",
    descriptionKey: "env.groups.network.desc",
  },
  {
    id: "mcp",
    labelKey: "env.groups.mcp.title",
    descriptionKey: "env.groups.mcp.desc",
  },
  {
    id: "plugins",
    labelKey: "env.groups.plugins.title",
    descriptionKey: "env.groups.plugins.desc",
  },
  {
    id: "privacy",
    labelKey: "env.groups.privacy.title",
    descriptionKey: "env.groups.privacy.desc",
  },
  {
    id: "advanced",
    labelKey: "env.groups.advanced.title",
    descriptionKey: "env.groups.advanced.desc",
  },
];

const ENV_VAR_SUGGESTION_SEEDS: EnvVarSuggestionSeed[] = [
  {
    key: "ANTHROPIC_API_KEY",
    desc: "作为 X-Api-Key 标头发送的 API 密钥，通常用于 Claude SDK（对于交互式使用，运行 /login）",
  },
  {
    key: "ANTHROPIC_AUTH_TOKEN",
    desc: "Authorization 标头的自定义值（您在此处设置的值将以 Bearer 为前缀）",
  },
  {
    key: "ANTHROPIC_BASE_URL",
    desc: "覆盖 API 端点，用于接入代理、网关或自建中转服务",
  },
  {
    key: "ANTHROPIC_CUSTOM_HEADERS",
    desc: "您想添加到请求的自定义标头（采用 Name: Value 格式）",
  },
  {
    key: "ANTHROPIC_CUSTOM_MODEL_OPTION",
    desc: "向 /model 选择器中添加一个自定义模型 ID，适合网关或非标准模型",
  },
  {
    key: "ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION",
    desc: "自定义模型选项的展示说明",
  },
  {
    key: "ANTHROPIC_CUSTOM_MODEL_OPTION_NAME",
    desc: "自定义模型选项的展示名称",
  },
  {
    key: "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    desc: "请参阅 模型配置",
  },
  {
    key: "ANTHROPIC_DEFAULT_OPUS_MODEL",
    desc: "请参阅 模型配置",
  },
  {
    key: "ANTHROPIC_DEFAULT_SONNET_MODEL",
    desc: "请参阅 模型配置",
  },
  {
    key: "ANTHROPIC_FOUNDRY_API_KEY",
    desc: "Microsoft Foundry 身份验证的 API 密钥（请参阅 Microsoft Foundry）",
  },
  {
    key: "ANTHROPIC_FOUNDRY_BASE_URL",
    desc: "Foundry 资源的完整基础 URL（例如 https://xxx.services.ai.azure.com/anthropic），可替代 ANTHROPIC_FOUNDRY_RESOURCE",
  },
  {
    key: "ANTHROPIC_FOUNDRY_RESOURCE",
    desc: "Foundry 资源名称（例如 my-resource）；未设置 ANTHROPIC_FOUNDRY_BASE_URL 时必需",
  },
  {
    key: "ANTHROPIC_MODEL",
    desc: "要使用的模型设置的名称（请参阅 模型配置）",
  },
  {
    key: "ANTHROPIC_SMALL_FAST_MODEL",
    desc: "[已弃用] 用于后台任务的 Haiku 级模型 的名称",
  },
  {
    key: "ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION",
    desc: "使用 Bedrock 时覆盖 Haiku 级模型的 AWS 区域",
  },
  {
    key: "AWS_BEARER_TOKEN_BEDROCK",
    desc: "Bedrock API 密钥用于身份验证（请参阅 Bedrock API 密钥）",
  },
  {
    key: "BASH_DEFAULT_TIMEOUT_MS",
    desc: "长时间运行的 bash 命令的默认超时",
  },
  {
    key: "BASH_MAX_OUTPUT_LENGTH",
    desc: "bash 输出中的最大字符数，超过此数字后输出将被中间截断",
  },
  {
    key: "BASH_MAX_TIMEOUT_MS",
    desc: "模型可以为长时间运行的 bash 命令设置的最大超时",
  },
  {
    key: "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE",
    desc: "设置自动压缩触发的上下文容量百分比（1-100）；默认约 95",
  },
  {
    key: "CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR",
    desc: "在每个 Bash 命令后返回到原始工作目录",
  },
  {
    key: "CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD",
    desc: "设置为 1 以从 --add-dir 指定的目录加载 CLAUDE.md 文件",
  },
  {
    key: "CLAUDE_CODE_API_KEY_HELPER_TTL_MS",
    desc: "应刷新凭证的间隔（以毫秒为单位）（使用 apiKeyHelper 时）",
  },
  {
    key: "CLAUDE_CODE_CLIENT_CERT",
    desc: "用于 mTLS 身份验证的客户端证书文件的路径",
  },
  {
    key: "CLAUDE_CODE_CLIENT_KEY_PASSPHRASE",
    desc: "加密 CLAUDE_CODE_CLIENT_KEY 的密码短语（可选）",
  },
  {
    key: "CLAUDE_CODE_CLIENT_KEY",
    desc: "用于 mTLS 身份验证的客户端私钥文件的路径",
  },
  {
    key: "CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING",
    desc: "设置为 1 以禁用 Opus 4.6 / Sonnet 4.6 的自适应推理",
  },
  {
    key: "CLAUDE_CODE_DISABLE_AUTO_MEMORY",
    desc: "设置为 1 以禁用自动记忆，设置为 0 可在灰度期间强制启用",
  },
  {
    key: "CLAUDE_CODE_DISABLE_BACKGROUND_TASKS",
    desc: "设置为 1 以禁用后台任务功能（含 run_in_background、自动后台处理、Ctrl+B）",
  },
  {
    key: "CLAUDE_CODE_DISABLE_CRON",
    desc: "设置为 1 以禁用定时任务和 /loop 相关能力",
  },
  {
    key: "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS",
    desc: "设置为 1 以禁用 Anthropic API 特定的 anthropic-beta 标头。当使用带有第三方提供商的 LLM 网关时遇到“Unexpected value(s) for the anthropic-beta header”之类的问题时使用此选项",
  },
  {
    key: "CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY",
    desc: "设置为 1 以禁用会话质量调查",
  },
  {
    key: "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
    desc: "等同于设置 DISABLE_AUTOUPDATER、DISABLE_BUG_COMMAND、DISABLE_ERROR_REPORTING 和 DISABLE_TELEMETRY",
  },
  {
    key: "CLAUDE_CODE_DISABLE_TERMINAL_TITLE",
    desc: "设置为 1 以禁用基于对话上下文的自动终端标题更新",
  },
  {
    key: "CLAUDE_CODE_EFFORT_LEVEL",
    desc: "为支持模型设置努力级别：low / medium / high / auto",
  },
  {
    key: "CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION",
    desc: "设置为 false 以禁用提示建议（输入框中的灰色预测）",
  },
  {
    key: "CLAUDE_CODE_ENABLE_TASKS",
    desc: "在非交互模式下启用任务追踪系统",
  },
  {
    key: "CLAUDE_CODE_ENABLE_TELEMETRY",
    desc: "设置为 1 以启用 OpenTelemetry 指标与日志数据收集",
  },
  {
    key: "CLAUDE_CODE_EXIT_AFTER_STOP_DELAY",
    desc: "查询循环空闲后自动退出前等待的毫秒数",
  },
  {
    key: "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS",
    desc: "设置为 1 以启用 agent teams（实验功能，默认禁用）",
  },
  {
    key: "CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS",
    desc: "覆盖文件读取的默认令牌限制。当您需要完整读取较大文件时很有用",
  },
  {
    key: "CLAUDE_CODE_HIDE_ACCOUNT_INFO",
    desc: "设置为 1 以从 Claude Code UI 中隐藏您的邮箱和组织名称，适合直播或录屏",
  },
  {
    key: "CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL",
    desc: "跳过 IDE 扩展的自动安装",
  },
  {
    key: "CLAUDE_CODE_MAX_OUTPUT_TOKENS",
    desc: "为大多数请求设置最大输出令牌数",
  },
  {
    key: "CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS",
    desc: "刷新动态 OpenTelemetry 标头的间隔（默认 29 分钟）",
  },
  {
    key: "CLAUDE_CODE_PLAN_MODE_REQUIRED",
    desc: "在需要计划审批的 agent team 队友上自动设为 true（只读，由系统生成）",
  },
  {
    key: "CLAUDE_CODE_PLUGIN_SEED_DIR",
    desc: "只读插件种子目录，可在容器镜像中预置插件缓存",
  },
  {
    key: "CLAUDE_CODE_PROXY_RESOLVES_HOSTS",
    desc: "设置为 true 以允许代理执行 DNS 解析",
  },
  {
    key: "CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS",
    desc: "SessionEnd hooks 的总超时预算（默认 1500ms）",
  },
  {
    key: "CLAUDE_CODE_SHELL",
    desc: "覆盖自动 shell 检测。当登录 shell 与首选工作 shell 不同时很有用（例如 bash 与 zsh）",
  },
  {
    key: "CLAUDE_CODE_SHELL_PREFIX",
    desc: "用于包装所有 bash 命令的前缀命令，可用于日志记录或审计",
  },
  {
    key: "CLAUDE_CODE_SIMPLE",
    desc: "设置为 1 以启用极简模式，只保留 Bash、文件读写工具并禁用 MCP、hooks、CLAUDE.md",
  },
  {
    key: "CLAUDE_CODE_SKIP_BEDROCK_AUTH",
    desc: "跳过 Bedrock 的 AWS 身份验证（例如，使用 LLM 网关时）",
  },
  {
    key: "CLAUDE_CODE_SKIP_FOUNDRY_AUTH",
    desc: "跳过 Microsoft Foundry 的 Azure 身份验证（例如，使用 LLM 网关时）",
  },
  {
    key: "CLAUDE_CODE_SKIP_VERTEX_AUTH",
    desc: "跳过 Vertex 的 Google 身份验证（例如，使用 LLM 网关时）",
  },
  {
    key: "CLAUDE_CODE_SUBAGENT_MODEL",
    desc: "请参阅 模型配置",
  },
  {
    key: "CLAUDE_CODE_TASK_LIST_ID",
    desc: "跨会话共享任务列表；多个 Claude Code 实例设置相同 ID 可协同任务",
  },
  {
    key: "CLAUDE_CODE_TEAM_NAME",
    desc: "当前队友所属 agent team 的名称（自动设置）",
  },
  {
    key: "CLAUDE_CODE_TMPDIR",
    desc: "覆盖内部临时文件目录（Claude Code 会在该目录下追加 /claude/）",
  },
  {
    key: "CLAUDE_CODE_USE_BEDROCK",
    desc: "使用 Bedrock",
  },
  {
    key: "CLAUDE_CODE_USE_FOUNDRY",
    desc: "使用 Microsoft Foundry",
  },
  {
    key: "CLAUDE_CODE_USE_VERTEX",
    desc: "使用 Vertex",
  },
  {
    key: "CLAUDE_CONFIG_DIR",
    desc: "自定义 Claude Code 存储其配置和数据文件的位置",
  },
  {
    key: "DISABLE_AUTOUPDATER",
    desc: "设置为 1 以禁用自动更新。",
  },
  {
    key: "DISABLE_BUG_COMMAND",
    desc: "设置为 1 以禁用 /bug 命令",
  },
  {
    key: "DISABLE_COST_WARNINGS",
    desc: "设置为 1 以禁用成本警告消息",
  },
  {
    key: "DISABLE_ERROR_REPORTING",
    desc: "设置为 1 以选择退出 Sentry 错误报告",
  },
  {
    key: "DISABLE_INSTALLATION_CHECKS",
    desc: "设置为 1 以禁用安装检查警告（仅在手动管理安装位置时使用）",
  },
  {
    key: "DISABLE_NON_ESSENTIAL_MODEL_CALLS",
    desc: "设置为 1 以禁用非关键路径（如风味文本）的模型调用",
  },
  {
    key: "DISABLE_PROMPT_CACHING",
    desc: "设置为 1 以禁用所有模型的提示缓存（优先于按模型设置）",
  },
  {
    key: "DISABLE_PROMPT_CACHING_HAIKU",
    desc: "设置为 1 以禁用 Haiku 模型的提示缓存",
  },
  {
    key: "DISABLE_PROMPT_CACHING_OPUS",
    desc: "设置为 1 以禁用 Opus 模型的提示缓存",
  },
  {
    key: "DISABLE_PROMPT_CACHING_SONNET",
    desc: "设置为 1 以禁用 Sonnet 模型的提示缓存",
  },
  {
    key: "DISABLE_TELEMETRY",
    desc: "设置为 1 以选择退出 Statsig 遥测（请注意，Statsig 事件不包括用户数据，如代码、文件路径或 bash 命令）",
  },
  {
    key: "ENABLE_TOOL_SEARCH",
    desc: "控制 MCP 工具搜索：auto / auto:N / true / false",
  },
  {
    key: "FORCE_AUTOUPDATE_PLUGINS",
    desc: "设置为 true 以强制插件自动更新（即使禁用了主自动更新）",
  },
  {
    key: "HTTP_PROXY",
    desc: "为网络连接指定 HTTP 代理服务器",
  },
  {
    key: "HTTPS_PROXY",
    desc: "为网络连接指定 HTTPS 代理服务器",
  },
  {
    key: "IS_DEMO",
    desc: "设置为 true 启用演示模式（隐藏账号信息、跳过入职、隐藏内部命令）",
  },
  {
    key: "MAX_MCP_OUTPUT_TOKENS",
    desc: "MCP 工具响应中允许的最大令牌数，当输出超过 10,000 个令牌时 Claude Code 显示警告（默认 25000）",
  },
  {
    key: "MAX_THINKING_TOKENS",
    desc: "启用扩展思考并为思考过程设置令牌预算，适合复杂推理与编码任务",
  },
  {
    key: "MCP_CLIENT_SECRET",
    desc: "为需要预配置凭证的 MCP 服务器提供 OAuth 客户端密钥",
  },
  {
    key: "MCP_OAUTH_CALLBACK_PORT",
    desc: "OAuth 回调固定端口（可替代添加 MCP 服务器时的 --callback-port）",
  },
  {
    key: "MCP_TIMEOUT",
    desc: "MCP 服务器启动的超时（以毫秒为单位）",
  },
  {
    key: "MCP_TOOL_TIMEOUT",
    desc: "MCP 工具执行的超时（以毫秒为单位）",
  },
  {
    key: "NO_PROXY",
    desc: "将直接发出请求的域和 IP 列表，绕过代理",
  },
  {
    key: "SLASH_COMMAND_TOOL_CHAR_BUDGET",
    desc: "显示给 Skill 工具的斜杠命令元数据的最大字符数",
  },
  {
    key: "USE_BUILTIN_RIPGREP",
    desc: "设置为 0 以使用系统安装的 rg 而不是 Claude Code 附带的 rg",
  },
  {
    key: "VERTEX_REGION_CLAUDE_3_5_HAIKU",
    desc: "使用 Vertex AI 时覆盖 Claude 3.5 Haiku 的区域",
  },
  {
    key: "VERTEX_REGION_CLAUDE_3_7_SONNET",
    desc: "使用 Vertex AI 时覆盖 Claude 3.7 Sonnet 的区域",
  },
  {
    key: "VERTEX_REGION_CLAUDE_4_0_OPUS",
    desc: "使用 Vertex AI 时覆盖 Claude 4.0 Opus 的区域",
  },
  {
    key: "VERTEX_REGION_CLAUDE_4_0_SONNET",
    desc: "使用 Vertex AI 时覆盖 Claude 4.0 Sonnet 的区域",
  },
  {
    key: "VERTEX_REGION_CLAUDE_4_1_OPUS",
    desc: "使用 Vertex AI 时覆盖 Claude 4.1 Opus 的区域",
  },
];

const ENV_VAR_OVERRIDES: Record<string, EnvVarSuggestionOverride> = {
  ANTHROPIC_API_KEY: {
    group: "auth",
    featured: true,
    placeholder: "sk-ant-...",
  },
  ANTHROPIC_AUTH_TOKEN: {
    group: "auth",
    placeholder: "oauth-token",
  },
  ANTHROPIC_BASE_URL: {
    group: "auth",
    featured: true,
    placeholder: "https://gateway.example.com",
  },
  ANTHROPIC_CUSTOM_HEADERS: {
    group: "network",
    placeholder: "X-Team: platform",
  },
  ANTHROPIC_CUSTOM_MODEL_OPTION: {
    group: "models",
    featured: true,
    placeholder: "my-gateway-model",
  },
  ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION: {
    group: "models",
    placeholder: "Gateway-specific model",
  },
  ANTHROPIC_CUSTOM_MODEL_OPTION_NAME: {
    group: "models",
    placeholder: "Custom Gateway Model",
  },
  ANTHROPIC_MODEL: {
    group: "models",
    featured: true,
    placeholder: "claude-sonnet-4-6",
  },
  ANTHROPIC_DEFAULT_HAIKU_MODEL: {
    group: "models",
    placeholder: "claude-3-5-haiku-latest",
  },
  ANTHROPIC_DEFAULT_OPUS_MODEL: {
    group: "models",
    placeholder: "claude-opus-4-1",
  },
  ANTHROPIC_DEFAULT_SONNET_MODEL: {
    group: "models",
    placeholder: "claude-sonnet-4-6",
  },
  ANTHROPIC_FOUNDRY_API_KEY: {
    group: "auth",
    placeholder: "foundry-key",
  },
  ANTHROPIC_FOUNDRY_BASE_URL: {
    group: "auth",
    placeholder: "https://resource.services.ai.azure.com/anthropic",
  },
  ANTHROPIC_FOUNDRY_RESOURCE: {
    group: "auth",
    placeholder: "my-foundry-resource",
  },
  ANTHROPIC_SMALL_FAST_MODEL: {
    group: "models",
    placeholder: "claude-3-5-haiku-latest",
  },
  ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION: {
    group: "auth",
    placeholder: "us-east-1",
  },
  AWS_BEARER_TOKEN_BEDROCK: {
    group: "auth",
    placeholder: "bedrock-token",
  },
  CLAUDE_CODE_USE_BEDROCK: {
    group: "auth",
    featured: true,
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_USE_FOUNDRY: {
    group: "auth",
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_USE_VERTEX: {
    group: "auth",
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_SKIP_BEDROCK_AUTH: {
    group: "auth",
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_SKIP_FOUNDRY_AUTH: {
    group: "auth",
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_SKIP_VERTEX_AUTH: {
    group: "auth",
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_CLIENT_CERT: {
    group: "auth",
    placeholder: "/path/to/client.crt",
  },
  CLAUDE_CODE_CLIENT_KEY: {
    group: "auth",
    placeholder: "/path/to/client.key",
  },
  CLAUDE_CODE_CLIENT_KEY_PASSPHRASE: {
    group: "auth",
    placeholder: "passphrase",
  },
  CLAUDE_CODE_DISABLE_AUTO_MEMORY: {
    group: "runtime",
    featured: true,
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_DISABLE_CRON: {
    group: "runtime",
    featured: true,
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_EFFORT_LEVEL: {
    group: "models",
    featured: true,
    quickValues: ["low", "medium", "high", "auto"],
  },
  CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION: {
    group: "runtime",
    quickValues: ["true", "false"],
  },
  CLAUDE_CODE_ENABLE_TASKS: {
    group: "runtime",
    quickValues: ["true", "false"],
  },
  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: {
    group: "runtime",
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL: {
    group: "runtime",
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_PLAN_MODE_REQUIRED: {
    group: "runtime",
    quickValues: ["true", "false"],
  },
  CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS: {
    group: "runtime",
    featured: true,
    placeholder: "1500",
  },
  CLAUDE_CODE_SIMPLE: {
    group: "runtime",
    featured: true,
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_TASK_LIST_ID: {
    group: "runtime",
    placeholder: "shared-task-list",
  },
  CLAUDE_CODE_TEAM_NAME: {
    group: "runtime",
    placeholder: "platform-team",
  },
  CLAUDE_CODE_SHELL: {
    group: "runtime",
    placeholder: "/bin/zsh",
  },
  CLAUDE_CODE_SHELL_PREFIX: {
    group: "runtime",
    placeholder: "/path/to/logger.sh",
  },
  CLAUDE_CODE_TMPDIR: {
    group: "runtime",
    placeholder: "/tmp/claude",
  },
  CLAUDE_CONFIG_DIR: {
    group: "runtime",
    placeholder: "~/.claude",
  },
  HTTP_PROXY: {
    group: "network",
    featured: true,
    placeholder: "http://proxy.example.com:8080",
  },
  HTTPS_PROXY: {
    group: "network",
    featured: true,
    placeholder: "http://proxy.example.com:8443",
  },
  NO_PROXY: {
    group: "network",
    placeholder: "localhost,127.0.0.1,.internal",
  },
  CLAUDE_CODE_PROXY_RESOLVES_HOSTS: {
    group: "network",
    quickValues: ["true", "false"],
  },
  ENABLE_TOOL_SEARCH: {
    group: "mcp",
    featured: true,
    quickValues: ["auto", "true", "false"],
  },
  MAX_MCP_OUTPUT_TOKENS: {
    group: "mcp",
    placeholder: "25000",
  },
  MCP_CLIENT_SECRET: {
    group: "mcp",
    placeholder: "client-secret",
  },
  MCP_OAUTH_CALLBACK_PORT: {
    group: "mcp",
    placeholder: "4319",
  },
  MCP_TIMEOUT: {
    group: "mcp",
    placeholder: "30000",
  },
  MCP_TOOL_TIMEOUT: {
    group: "mcp",
    placeholder: "60000",
  },
  CLAUDE_CODE_PLUGIN_SEED_DIR: {
    group: "plugins",
    featured: true,
    placeholder: "/opt/claude/plugins:/workspace/plugins-cache",
  },
  FORCE_AUTOUPDATE_PLUGINS: {
    group: "plugins",
    featured: true,
    quickValues: ["true", "false"],
  },
  DISABLE_AUTOUPDATER: {
    group: "plugins",
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: {
    group: "privacy",
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: {
    group: "privacy",
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_DISABLE_TERMINAL_TITLE: {
    group: "privacy",
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_ENABLE_TELEMETRY: {
    group: "privacy",
    quickValues: ["1", "0"],
  },
  CLAUDE_CODE_HIDE_ACCOUNT_INFO: {
    group: "privacy",
    quickValues: ["1", "0"],
  },
  DISABLE_ERROR_REPORTING: {
    group: "privacy",
    quickValues: ["1", "0"],
  },
  DISABLE_TELEMETRY: {
    group: "privacy",
    quickValues: ["1", "0"],
  },
  IS_DEMO: {
    group: "privacy",
    featured: true,
    quickValues: ["true", "false"],
  },
  MAX_THINKING_TOKENS: {
    group: "models",
    placeholder: "8000",
  },
  SLASH_COMMAND_TOOL_CHAR_BUDGET: {
    group: "advanced",
    placeholder: "16000",
  },
  USE_BUILTIN_RIPGREP: {
    group: "advanced",
    quickValues: ["1", "0"],
  },
};

function inferEnvVarGroup(key: string): Exclude<EnvVarGroupId, "custom"> {
  const overrideGroup = ENV_VAR_OVERRIDES[key]?.group;
  if (overrideGroup) return overrideGroup;

  if (key.startsWith("HTTP_") || key.startsWith("HTTPS_") || key === "NO_PROXY") {
    return "network";
  }

  if (key.startsWith("MCP_") || key === "ENABLE_TOOL_SEARCH") {
    return "mcp";
  }

  if (key.includes("PLUGIN")) {
    return "plugins";
  }

  if (
    key.startsWith("ANTHROPIC_MODEL") ||
    key.startsWith("ANTHROPIC_DEFAULT_") ||
    key.startsWith("VERTEX_REGION_") ||
    key === "MAX_THINKING_TOKENS" ||
    key.endsWith("_MODEL")
  ) {
    return "models";
  }

  if (
    key.startsWith("DISABLE_") ||
    key.includes("TELEMETRY") ||
    key.includes("ERROR_REPORTING") ||
    key.includes("HIDE_ACCOUNT_INFO") ||
    key === "IS_DEMO"
  ) {
    return "privacy";
  }

  if (
    key.startsWith("ANTHROPIC_") ||
    key.startsWith("AWS_") ||
    key.startsWith("CLAUDE_CODE_USE_") ||
    key.startsWith("CLAUDE_CODE_SKIP_")
  ) {
    return "auth";
  }

  if (
    key.startsWith("CLAUDE_CODE_") ||
    key.startsWith("CLAUDE_") ||
    key.startsWith("BASH_") ||
    key === "CLAUDE_CONFIG_DIR"
  ) {
    return "runtime";
  }

  return "advanced";
}

function inferPlaceholder(key: string): string | undefined {
  if (key.endsWith("_API_KEY")) return "sk-ant-...";
  if (key.endsWith("_TOKEN")) return "token";
  if (key.endsWith("_SECRET")) return "secret";
  if (key.includes("BASE_URL") || key.endsWith("_URL")) return "https://example.com";
  if (key.endsWith("_PORT")) return "3000";
  if (key.endsWith("_TIMEOUT_MS")) return "1500";
  if (key.endsWith("_DIR") || key.endsWith("_PATH")) return "/path/to/resource";
  if (key.includes("MODEL")) return "claude-sonnet-4-6";
  return undefined;
}

export const ENV_VAR_SUGGESTIONS: EnvVarSuggestion[] = ENV_VAR_SUGGESTION_SEEDS.map((item) => {
  const overrides = ENV_VAR_OVERRIDES[item.key] ?? {};
  return {
    key: item.key,
    desc: item.desc,
    group: overrides.group ?? inferEnvVarGroup(item.key),
    featured: overrides.featured ?? false,
    placeholder: overrides.placeholder ?? inferPlaceholder(item.key),
    quickValues: overrides.quickValues,
  };
});

const ENV_VAR_SUGGESTION_LOOKUP = new Map(
  ENV_VAR_SUGGESTIONS.map((item) => [item.key.toUpperCase(), item]),
);

export function getEnvVarSuggestion(key: string): EnvVarSuggestion | undefined {
  return ENV_VAR_SUGGESTION_LOOKUP.get(key.trim().toUpperCase());
}

export function getEnvVarGroup(key: string): EnvVarGroupId {
  return getEnvVarSuggestion(key)?.group ?? "custom";
}
