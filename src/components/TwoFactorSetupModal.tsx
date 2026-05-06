import React, { useState } from 'react';
import { useAuth, API } from '@/src/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TwoFactorSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Step = 'init' | 'setup' | 'verify' | 'complete';

const TwoFactorSetupModal: React.FC<TwoFactorSetupModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<Step>('init');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);

  const token = localStorage.getItem('token');

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/setup-2fa`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to setup 2FA');
      }

      setQrCode(data.qr_code);
      setSecret(data.secret);
      setStep('setup');
    } catch (err: any) {
      toast.error(err.message || 'Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setSecretCopied(true);
    toast.success('Secret copied to clipboard');
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/enable-2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`,
        },
        body: new URLSearchParams({
          secret: secret,
          totp_code: verificationCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Invalid code');
      }

      toast.success('Two-Factor Authentication enabled successfully!');
      setStep('complete');
      setTimeout(() => {
        onComplete();
        handleClose();
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('init');
    setQrCode('');
    setSecret('');
    setVerificationCode('');
    setSecretCopied(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="bg-[#16161a] border border-[#2d2d35] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Step 1: Introduction */}
        {step === 'init' && (
          <div className="p-6">
            <h2 className="text-2xl font-bold text-[#f0f0f2] mb-4 text-center">
              Enable Two-Factor Authentication
            </h2>

            <div className="bg-[#1e1e24] border border-[#2d2d35] rounded-lg p-4 mb-6">
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                Two-factor authentication adds an extra layer of security to your account. You'll need to enter a code from your authenticator app every time you log in.
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#3b82f6] flex items-center justify-center text-white text-xs font-bold">
                  1
                </div>
                <div>
                  <p className="font-semibold text-[#f0f0f2]">Download an authenticator app</p>
                  <p className="text-xs text-[#a1a1aa]">Google Authenticator, Microsoft Authenticator, or Authy</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#3b82f6] flex items-center justify-center text-white text-xs font-bold">
                  2
                </div>
                <div>
                  <p className="font-semibold text-[#f0f0f2]">Scan the QR code</p>
                  <p className="text-xs text-[#a1a1aa]">We'll show you a QR code in the next step</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#3b82f6] flex items-center justify-center text-white text-xs font-bold">
                  3
                </div>
                <div>
                  <p className="font-semibold text-[#f0f0f2]">Verify the code</p>
                  <p className="text-xs text-[#a1a1aa]">Enter the 6-digit code from your app</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleClose}
                className="flex-1 bg-[#2d2d35] hover:bg-[#3d3d45] text-[#f0f0f2]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleStart}
                className="flex-1 bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white font-bold"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Scan QR Code */}
        {step === 'setup' && (
          <div className="p-6">
            <h2 className="text-2xl font-bold text-[#f0f0f2] mb-4 text-center">
              Scan QR Code
            </h2>

            <p className="text-sm text-[#a1a1aa] text-center mb-6">
              Scan this QR code with your authenticator app
            </p>

            {/* QR Code Display */}
            <div className="bg-white p-4 rounded-lg mb-6 flex justify-center">
              {qrCode ? (
                <img src={qrCode} alt="QR Code" className="w-48 h-48" />
              ) : (
                <div className="w-48 h-48 bg-[#2d2d35] rounded flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#a1a1aa]" />
                </div>
              )}
            </div>

            {/* Manual Entry Key */}
            <div className="bg-[#1e1e24] border border-[#2d2d35] rounded-lg p-4 mb-6">
              <p className="text-xs font-bold uppercase text-[#a1a1aa] tracking-wider mb-2">
                Can't scan? Enter this key manually:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-[#f0f0f2] break-all">
                  {secret}
                </code>
                <Button
                  size="sm"
                  onClick={handleCopySecret}
                  className="bg-[#2d2d35] hover:bg-[#3d3d45]"
                >
                  {secretCopied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              onClick={() => setStep('verify')}
              className="w-full bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white font-bold"
            >
              I've Scanned the Code
            </Button>
          </div>
        )}

        {/* Step 3: Verify Code */}
        {step === 'verify' && (
          <div className="p-6">
            <h2 className="text-2xl font-bold text-[#f0f0f2] mb-4 text-center">
              Verify Your Code
            </h2>

            <p className="text-sm text-[#a1a1aa] text-center mb-6">
              Enter the 6-digit code from your authenticator app
            </p>

            <div className="mb-6">
              <Input
                type="text"
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="000000"
                maxLength={6}
                className="bg-[#1e1e24] border-[#2d2d35] text-[#f0f0f2] text-center text-3xl tracking-widest font-bold py-3"
              />
            </div>

            <div className="bg-[#1e1e24] border border-[#2d2d35] rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#a1a1aa]">
                  Make sure your phone's time is synchronized with your computer for accurate codes.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setStep('setup')}
                className="flex-1 bg-[#2d2d35] hover:bg-[#3d3d45] text-[#f0f0f2]"
                disabled={loading}
              >
                Back
              </Button>
              <Button
                onClick={handleVerify}
                className="flex-1 bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white font-bold"
                disabled={loading || verificationCode.length !== 6}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Verify'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 'complete' && (
          <div className="p-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-[#f0f0f2] mb-2">Success!</h2>
            <p className="text-[#a1a1aa] mb-6">
              Two-factor authentication is now enabled on your account.
            </p>
            <div className="bg-green-400/10 border border-green-400/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-400">
                ✓ Your account is now more secure
              </p>
            </div>
            <Button
              onClick={handleClose}
              className="w-full bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white font-bold"
            >
              Close
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TwoFactorSetupModal;
