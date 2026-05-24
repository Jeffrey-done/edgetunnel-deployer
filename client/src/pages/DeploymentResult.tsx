import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageCircle,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function DeploymentResult() {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const [, setLocation] = useLocation();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 获取部署结果
  const { data: result, isLoading } = trpc.deployment.getResult.useQuery(
    { deploymentId: deploymentId || '' },
    { enabled: !!deploymentId }
  );

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('已复制到剪贴板');
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">加载结果中...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md">
          <Alert className="bg-red-50 border-red-200">
            <AlertDescription className="text-red-700">
              无法加载部署结果，请重试
            </AlertDescription>
          </Alert>
          <Button
            onClick={() => setLocation('/')}
            className="w-full mt-4"
          >
            返回首页
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 成功标题 */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            部署成功！
          </h1>
          <p className="text-gray-600 text-lg">
            您的 edgetunnel Worker 已成功部署到 Cloudflare
          </p>
        </div>

        {/* 结果信息卡片 */}
        <div className="space-y-6">
          {/* Worker URL */}
          <Card className="p-6 border-0 shadow-lg">
            <div className="flex items-start gap-4">
              <Zap className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Worker 访问地址
                </h2>
                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                  <code className="flex-1 text-sm text-gray-700 break-all">
                    {result.workerUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      copyToClipboard(result.workerUrl, 'workerUrl')
                    }
                    className={
                      copiedField === 'workerUrl'
                        ? 'text-green-600'
                        : 'text-gray-600'
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  这是您的 Worker 的公开访问地址
                </p>
              </div>
            </div>
          </Card>

          {/* 订阅链接 */}
          <Card className="p-6 border-0 shadow-lg">
            <div className="flex items-start gap-4">
              <ExternalLink className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  订阅链接
                </h2>
                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                  <code className="flex-1 text-sm text-gray-700 break-all">
                    {result.subscriptionUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      copyToClipboard(result.subscriptionUrl, 'subscriptionUrl')
                    }
                    className={
                      copiedField === 'subscriptionUrl'
                        ? 'text-green-600'
                        : 'text-gray-600'
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  在您的 VPN 客户端中添加此订阅链接以获取节点列表
                </p>
              </div>
            </div>
          </Card>

          {/* Telegram 机器人 (如果已配置) */}
          {result.telegramBotUsername && (
            <Card className="p-6 border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
              <div className="flex items-start gap-4">
                <MessageCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    Telegram 机器人已配置
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        机器人用户名:
                      </p>
                      <div className="flex items-center gap-2 bg-white p-3 rounded-lg">
                        <code className="flex-1 text-sm text-gray-700">
                          @{result.telegramBotUsername}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(
                              `@${result.telegramBotUsername}`,
                              'botUsername'
                            )
                          }
                          className={
                            copiedField === 'botUsername'
                              ? 'text-green-600'
                              : 'text-gray-600'
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        可用命令:
                      </p>
                      <ul className="space-y-1 text-sm text-gray-700">
                        <li>
                          <code className="bg-white px-2 py-1 rounded">
                            /status
                          </code>{' '}
                          - 查看系统状态
                        </li>
                        <li>
                          <code className="bg-white px-2 py-1 rounded">
                            /nodes
                          </code>{' '}
                          - 查看最优节点
                        </li>
                        <li>
                          <code className="bg-white px-2 py-1 rounded">
                            /optimize
                          </code>{' '}
                          - 触发节点优化
                        </li>
                        <li>
                          <code className="bg-white px-2 py-1 rounded">
                            /help
                          </code>{' '}
                          - 查看帮助信息
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* 快速开始指南 */}
          <Card className="p-6 border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              快速开始指南
            </h2>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>
                  在您的 VPN 客户端（如 Clash, Shadowrocket 等）中添加订阅链接
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>更新订阅以获取最新的节点列表</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>
                  {result.telegramBotUsername
                    ? `在 Telegram 中找到 @${result.telegramBotUsername} 并发送 /help 获取更多功能`
                    : '（可选）配置 Telegram 机器人以远程管理您的 Worker'}
                </span>
              </li>
            </ol>
          </Card>
        </div>

        {/* 底部操作按钮 */}
        <div className="mt-8 flex gap-4 justify-center">
          <Button
            onClick={() => window.open(result.workerUrl, '_blank')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            访问 Worker
          </Button>
          <Button
            onClick={() => setLocation('/')}
            variant="outline"
          >
            新建部署
          </Button>
        </div>

        {/* 部署信息 */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            部署 ID:{' '}
            <code className="bg-gray-100 px-2 py-1 rounded">
              {deploymentId}
            </code>
          </p>
          <p className="mt-2">
            部署时间: {new Date(result.deployedAt).toLocaleString('zh-CN')}
          </p>
        </div>
      </div>
    </div>
  );
}
