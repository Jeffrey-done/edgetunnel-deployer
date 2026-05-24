import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface DeploymentStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  error?: string;
  timestamp?: Date;
}

const INITIAL_STEPS: DeploymentStep[] = [
  {
    id: 'validate',
    name: 'Token 验证',
    description: '验证 Cloudflare API Token 有效性',
    status: 'pending',
  },
  {
    id: 'kv',
    name: 'KV 命名空间',
    description: '创建或检测 KV 命名空间',
    status: 'pending',
  },
  {
    id: 'deploy',
    name: 'Worker 部署',
    description: '上传并部署 Worker 脚本',
    status: 'pending',
  },
  {
    id: 'webhook',
    name: 'Webhook 配置',
    description: '配置 Telegram Bot Webhook',
    status: 'pending',
  },
];

export default function DeploymentProgress() {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const [, setLocation] = useLocation();
  const [steps, setSteps] = useState<DeploymentStep[]>(INITIAL_STEPS);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);

  // 获取部署状态
  const { data: deploymentStatus, isLoading } = trpc.deployment.getStatus.useQuery(
    { deploymentId: deploymentId || '' },
    {
      enabled: !!deploymentId,
      refetchInterval: 1000, // 每秒刷新一次
    }
  );

  // 更新步骤状态
  useEffect(() => {
    if (!deploymentStatus) return;

    const newSteps = INITIAL_STEPS.map((step) => {
      const statusData = deploymentStatus.steps[step.id];
      if (!statusData) return step;

      return {
        ...step,
        status: statusData.status,
        error: statusData.error,
        timestamp: statusData.timestamp,
      };
    });

    setSteps(newSteps);

    // 检查是否完成或失败
    const allCompleted = newSteps.every((s) => s.status === 'completed');
    const hasFailed = newSteps.some((s) => s.status === 'failed');

    if (allCompleted) {
      setIsComplete(true);
      // 3 秒后跳转到结果页面
      setTimeout(() => {
        setLocation(`/result/${deploymentId}`);
      }, 3000);
    }

    if (hasFailed) {
      setHasError(true);
    }
  }, [deploymentStatus, deploymentId, setLocation]);

  const getStepIcon = (status: DeploymentStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in-progress':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-300" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            正在部署您的 Worker
          </h1>
          <p className="text-gray-600">
            {isComplete ? '部署完成！' : '请稍候，部署过程中...'}
          </p>
        </div>

        {/* 进度卡片 */}
        <Card className="p-8 shadow-lg border-0 space-y-6">
          {/* 步骤列表 */}
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id}>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getStepIcon(step.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">
                        {step.name}
                      </h3>
                      {step.status === 'completed' && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          完成
                        </span>
                      )}
                      {step.status === 'in-progress' && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          进行中
                        </span>
                      )}
                      {step.status === 'failed' && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                          失败
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {step.description}
                    </p>
                    {step.error && (
                      <p className="text-sm text-red-600 mt-2">
                        错误: {step.error}
                      </p>
                    )}
                  </div>
                </div>

                {/* 连接线 */}
                {index < steps.length - 1 && (
                  <div className="ml-2.5 h-6 border-l-2 border-gray-200 my-2" />
                )}
              </div>
            ))}
          </div>

          {/* 错误提示 */}
          {hasError && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                部署过程中出现错误，请检查您的配置并重试
              </AlertDescription>
            </Alert>
          )}

          {/* 完成提示 */}
          {isComplete && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                部署成功！正在跳转到结果页面...
              </AlertDescription>
            </Alert>
          )}

          {/* 进度条 */}
          <div className="mt-8">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>进度</span>
              <span>
                {steps.filter((s) => s.status === 'completed').length} /{' '}
                {steps.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    (steps.filter((s) => s.status === 'completed').length /
                      steps.length) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        </Card>

        {/* 底部提示 */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            部署 ID: <code className="bg-gray-100 px-2 py-1 rounded">{deploymentId}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
