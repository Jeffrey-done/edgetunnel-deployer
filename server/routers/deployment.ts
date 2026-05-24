import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { nanoid } from 'nanoid';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// 部署步骤状态类型
interface StepStatus {
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  error?: string;
  timestamp?: Date;
}

// 内存中存储部署状态（实际应用应使用数据库）
const deploymentStates = new Map<
  string,
  {
    steps: Record<string, StepStatus>;
    result?: {
      workerUrl: string;
      subscriptionUrl: string;
      telegramBotUsername?: string;
      deployedAt: Date;
    };
  }
>();

export const deploymentRouter = router({
  // 开始部署
  deploy: publicProcedure
    .input(
      z.object({
        cfToken: z.string().min(1, 'Token 不能为空'),
        cfEmail: z.string().email('邮箱格式不正确'),
        workerName: z.string().regex(/^[a-zA-Z0-9_-]{1,63}$/, 'Worker 名称格式不正确'),
        tgBotToken: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const deploymentId = nanoid();

      // 初始化部署状态
      deploymentStates.set(deploymentId, {
        steps: {
          validate: { status: 'pending' },
          kv: { status: 'pending' },
          deploy: { status: 'pending' },
          webhook: { status: 'pending' },
        },
      });

      // 异步执行部署流程
      executeDeployment(deploymentId, input).catch((error) => {
        console.error(`Deployment ${deploymentId} failed:`, error);
      });

      return { deploymentId };
    }),

  // 获取部署状态
  getStatus: publicProcedure
    .input(z.object({ deploymentId: z.string() }))
    .query(({ input }) => {
      const state = deploymentStates.get(input.deploymentId);
      if (!state) {
        throw new Error('部署不存在');
      }
      return { steps: state.steps };
    }),

  // 获取部署结果
  getResult: publicProcedure
    .input(z.object({ deploymentId: z.string() }))
    .query(({ input }) => {
      const state = deploymentStates.get(input.deploymentId);
      if (!state || !state.result) {
        throw new Error('部署结果不存在');
      }
      return state.result;
    }),
});

// 执行部署流程
async function executeDeployment(
  deploymentId: string,
  input: {
    cfToken: string;
    cfEmail: string;
    workerName: string;
    tgBotToken?: string;
  }
) {
  const state = deploymentStates.get(deploymentId);
  if (!state) return;

  try {
    // 第一步：验证 Token 并获取匹配的 Account ID
    await updateStepStatus(deploymentId, 'validate', 'in-progress');
    const { accountId, accountName } = await validateAndGetAccountId(input.cfToken, input.cfEmail);
    await updateStepStatus(deploymentId, 'validate', 'completed');

    // 第二步：创建/检测 KV 命名空间
    await updateStepStatus(deploymentId, 'kv', 'in-progress');
    const kvId = await createOrGetKVNamespace(input.cfToken, accountId);
    await updateStepStatus(deploymentId, 'kv', 'completed');

    // 第三步：部署 Worker
    await updateStepStatus(deploymentId, 'deploy', 'in-progress');
    const workerUrl = await deployWorker(
      input.cfToken,
      accountId,
      input.workerName,
      kvId
    );
    await updateStepStatus(deploymentId, 'deploy', 'completed');

    // 第四步：配置 Telegram Webhook（如果提供了 Bot Token）
    if (input.tgBotToken) {
      await updateStepStatus(deploymentId, 'webhook', 'in-progress');
      await setupTelegramWebhook(input.tgBotToken, workerUrl);
      await updateStepStatus(deploymentId, 'webhook', 'completed');
    } else {
      await updateStepStatus(deploymentId, 'webhook', 'completed');
    }

    // 设置结果
    const subscriptionUrl = `${workerUrl}/sub`;
    state.result = {
      workerUrl,
      subscriptionUrl,
      deployedAt: new Date(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    const failedStep = getFailedStep(state);
    if (failedStep) {
      await updateStepStatus(deploymentId, failedStep, 'failed', message);
    }
  }
}

// 更新步骤状态
async function updateStepStatus(
  deploymentId: string,
  stepId: string,
  status: 'pending' | 'in-progress' | 'completed' | 'failed',
  error?: string
) {
  const state = deploymentStates.get(deploymentId);
  if (!state) return;

  state.steps[stepId] = {
    status,
    error,
    timestamp: new Date(),
  };
}

// 获取失败的步骤
function getFailedStep(state: any): string | null {
  for (const [stepId, stepStatus] of Object.entries(state.steps)) {
    if ((stepStatus as StepStatus).status === 'in-progress') {
      return stepId;
    }
  }
  return null;
}

// 验证 Token 并获取 Account ID (改进匹配逻辑)
async function validateAndGetAccountId(
  token: string,
  email: string
): Promise<{ accountId: string; accountName: string }> {
  try {
    const response = await axios.get('https://api.cloudflare.com/client/v4/accounts', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.data.success || response.data.result.length === 0) {
      throw new Error('Token 验证失败或无账户信息');
    }

    const accounts = response.data.result;
    
    // 1. 尝试精确匹配邮箱
    const matchedAccount = accounts.find((acc: any) => 
      acc.name.toLowerCase() === email.toLowerCase() || 
      acc.settings?.enforce_two_factor === email.toLowerCase() // 某些情况下 name 可能不是邮箱
    );

    if (matchedAccount) {
      return { accountId: matchedAccount.id, accountName: matchedAccount.name };
    }

    // 2. 降级到第一个账户
    return { accountId: accounts[0].id, accountName: accounts[0].name };
  } catch (error: any) {
    const msg = error.response?.data?.errors?.[0]?.message || error.message;
    throw new Error(`Token 验证失败: ${msg}`);
  }
}

// 创建或获取 KV 命名空间
async function createOrGetKVNamespace(
  token: string,
  accountId: string
): Promise<string> {
  try {
    // 先尝试获取现有的 KV 命名空间
    const listResponse = await axios.get(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (listResponse.data.success) {
      // 查找名为 'edgetunnel-kv' 的命名空间
      const existing = listResponse.data.result.find(
        (ns: any) => ns.title === 'edgetunnel-kv'
      );
      if (existing) {
        return existing.id;
      }
    }

    // 如果不存在，创建新的命名空间
    const createResponse = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces`,
      { title: 'edgetunnel-kv' },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!createResponse.data.success) {
      throw new Error('KV 命名空间创建失败');
    }

    return createResponse.data.result.id;
  } catch (error: any) {
    const msg = error.response?.data?.errors?.[0]?.message || error.message;
    throw new Error(`KV 命名空间操作失败: ${msg}`);
  }
}

// 部署 Worker
async function deployWorker(
  token: string,
  accountId: string,
  workerName: string,
  kvId: string
): Promise<string> {
  try {
    // 读取本地模板代码
    const templatePath = path.join(process.cwd(), 'server', 'worker-template.js');
    let scriptContent = '';
    
    if (fs.existsSync(templatePath)) {
      scriptContent = fs.readFileSync(templatePath, 'utf-8');
    } else {
      // 如果文件不存在，回退到从 GitHub 下载
      const githubUrl = 'https://raw.githubusercontent.com/cmliu/edgetunnel/main/_worker.js';
      const response = await axios.get(githubUrl);
      scriptContent = response.data;
    }

    // 构造 Worker 脚本元数据（绑定 KV）
    const metadata = {
      main_module: 'index.js',
      bindings: [
        {
          type: 'kv_namespace',
          name: 'KV',
          namespace_id: kvId,
        },
      ],
    };

    // 使用 multipart/form-data 上传
    const FormData = require('form-data');
    const form = new FormData();
    form.append('metadata', JSON.stringify(metadata), {
      contentType: 'application/json',
    });
    form.append('script', scriptContent, {
      filename: 'index.js',
      contentType: 'application/javascript',
    });

    const uploadResponse = await axios.put(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
      form,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...form.getHeaders(),
        },
      }
    );

    if (!uploadResponse.data.success) {
      throw new Error('Worker 脚本上传失败');
    }

    // 获取 Worker 子域名（如果尚未启用）
    const subdomainResponse = await axios.get(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let subdomain = '';
    if (subdomainResponse.data.success) {
      subdomain = subdomainResponse.data.result.subdomain;
    } else {
      throw new Error('无法获取 Cloudflare Workers 子域名，请确保已在控制面板配置');
    }

    return `https://${workerName}.${subdomain}.workers.dev`;
  } catch (error: any) {
    const msg = error.response?.data?.errors?.[0]?.message || error.message;
    throw new Error(`Worker 部署失败: ${msg}`);
  }
}

// 设置 Telegram Webhook
async function setupTelegramWebhook(
  botToken: string,
  workerUrl: string
): Promise<void> {
  try {
    const webhookUrl = `${workerUrl}/tg-webhook`;
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      { url: webhookUrl }
    );

    if (!response.data.ok) {
      throw new Error(`Telegram API 错误: ${response.data.description}`);
    }
  } catch (error: any) {
    const msg = error.response?.data?.description || error.message;
    throw new Error(`Telegram Webhook 配置失败: ${msg}`);
  }
}
