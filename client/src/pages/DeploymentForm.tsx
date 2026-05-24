import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';

interface FormData {
  cfToken: string;
  cfEmail: string;
  workerName: string;
  tgBotToken?: string;
}

export default function DeploymentForm() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<FormData>({
    cfToken: '',
    cfEmail: '',
    workerName: 'edgetunnel',
    tgBotToken: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deployMutation = trpc.deployment.deploy.useMutation({
    onSuccess: (result) => {
      setIsSubmitting(false);
      // 跳转到进度页面，传递部署 ID
      setLocation(`/deployment/${result.deploymentId}`);
    },
    onError: (error) => {
      setIsSubmitting(false);
      setErrors({ submit: error.message || '部署失败，请重试' });
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.cfToken.trim()) {
      newErrors.cfToken = 'Cloudflare API Token 不能为空';
    }
    if (!formData.cfEmail.trim()) {
      newErrors.cfEmail = '账户邮箱不能为空';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.cfEmail)) {
      newErrors.cfEmail = '请输入有效的邮箱地址';
    }
    if (!formData.workerName.trim()) {
      newErrors.workerName = 'Worker 名称不能为空';
    } else if (!/^[a-zA-Z0-9_-]{1,63}$/.test(formData.workerName)) {
      newErrors.workerName = 'Worker 名称只能包含字母、数字、下划线和连字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    deployMutation.mutate({
      cfToken: formData.cfToken,
      cfEmail: formData.cfEmail,
      workerName: formData.workerName,
      tgBotToken: formData.tgBotToken || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            edgetunnel 一键部署
          </h1>
          <p className="text-gray-600">
            轻松部署您的 Cloudflare Worker 隧道
          </p>
        </div>

        {/* 表单卡片 */}
        <Card className="p-8 shadow-lg border-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Cloudflare Token */}
            <div className="space-y-2">
              <Label htmlFor="cfToken" className="text-sm font-medium">
                Cloudflare API Token <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cfToken"
                type="password"
                placeholder="输入您的 API Token"
                value={formData.cfToken}
                onChange={(e) => {
                  setFormData({ ...formData, cfToken: e.target.value });
                  if (errors.cfToken) {
                    setErrors({ ...errors, cfToken: '' });
                  }
                }}
                className={errors.cfToken ? 'border-red-500' : ''}
              />
              {errors.cfToken && (
                <p className="text-xs text-red-500">{errors.cfToken}</p>
              )}
              <p className="text-xs text-gray-500">
                从 Cloudflare 控制面板获取具有 Worker 权限的 API Token
              </p>
            </div>

            {/* 账户邮箱 */}
            <div className="space-y-2">
              <Label htmlFor="cfEmail" className="text-sm font-medium">
                账户邮箱 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cfEmail"
                type="email"
                placeholder="your@email.com"
                value={formData.cfEmail}
                onChange={(e) => {
                  setFormData({ ...formData, cfEmail: e.target.value });
                  if (errors.cfEmail) {
                    setErrors({ ...errors, cfEmail: '' });
                  }
                }}
                className={errors.cfEmail ? 'border-red-500' : ''}
              />
              {errors.cfEmail && (
                <p className="text-xs text-red-500">{errors.cfEmail}</p>
              )}
            </div>

            {/* Worker 名称 */}
            <div className="space-y-2">
              <Label htmlFor="workerName" className="text-sm font-medium">
                Worker 名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="workerName"
                type="text"
                placeholder="edgetunnel"
                value={formData.workerName}
                onChange={(e) => {
                  setFormData({ ...formData, workerName: e.target.value });
                  if (errors.workerName) {
                    setErrors({ ...errors, workerName: '' });
                  }
                }}
                className={errors.workerName ? 'border-red-500' : ''}
              />
              {errors.workerName && (
                <p className="text-xs text-red-500">{errors.workerName}</p>
              )}
              <p className="text-xs text-gray-500">
                只能包含字母、数字、下划线和连字符，长度 1-63 个字符
              </p>
            </div>

            {/* Telegram Bot Token (可选) */}
            <div className="space-y-2">
              <Label htmlFor="tgBotToken" className="text-sm font-medium">
                Telegram Bot Token <span className="text-gray-400">(可选)</span>
              </Label>
              <Input
                id="tgBotToken"
                type="password"
                placeholder="输入您的 Telegram Bot Token"
                value={formData.tgBotToken}
                onChange={(e) =>
                  setFormData({ ...formData, tgBotToken: e.target.value })
                }
              />
              <p className="text-xs text-gray-500">
                如果提供，将自动配置 Telegram 机器人 Webhook
              </p>
            </div>

            {/* 错误提示 */}
            {errors.submit && (
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  {errors.submit}
                </AlertDescription>
              </Alert>
            )}

            {/* 提交按钮 */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在部署...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  开始部署
                </>
              )}
            </Button>
          </form>

          {/* 底部提示 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              🔒 您的 API Token 仅用于此次部署，不会被保存或共享
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
