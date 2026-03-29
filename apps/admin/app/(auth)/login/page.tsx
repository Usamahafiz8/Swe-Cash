'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      router.replace('/users');
    }
  }, [router]);

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(email, password),
    onSuccess: (res) => {
      const { token, admin } = res.data;
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(admin));
      router.replace('/users');
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Invalid email or password';
      setFormError(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!email || !password) {
      setFormError('Email and password are required.');
      return;
    }
    loginMutation.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">SweCash Admin</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to your admin account</p>
        </div>

        {/* Card */}
        <div className="rounded-xl bg-white p-8 shadow-2xl">
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              <Input
                label="Email address"
                type="email"
                placeholder="admin@swecash.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              {formError && (
                <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={loginMutation.isPending}
              >
                Sign in
              </Button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Authorized personnel only
        </p>
      </div>
    </div>
  );
}
