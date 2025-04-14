import { useEffect, useState } from 'react';
import MultiStepSignUpFree from './MultiStepSignUpFree';
import MultiStepSignUpPaid from './MultiStepSignUpPaid';

export default function MultiStepSignUp() {
  const [signupType, setSignupType] = useState<'free' | 'paid' | null>(null);
  const [initialSpot, setInitialSpot] = useState<string | null>(null);

  useEffect(() => {
    // Check if this is a premium signup from the pricing section
    const signupType = localStorage.getItem('signupType');
    if (signupType === 'premium') {
      setSignupType('paid');
    } else {
      setSignupType('free');
      // Clear any existing signup type to ensure default behavior
      localStorage.removeItem('signupType');
    }
  }, []);

  const handleUpgradeToPremium = () => {
    localStorage.setItem('signupType', 'premium');
    setSignupType('paid');
  };

  const handleSwitchToFree = (firstSpot: string) => {
    setInitialSpot(firstSpot);
    localStorage.removeItem('signupType');
    setSignupType('free');
  };

  if (signupType === null) {
    return (
      <div className="w-full max-w-4xl mx-auto flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return signupType === 'paid' ? (
    <MultiStepSignUpPaid onSwitchToFree={handleSwitchToFree} />
  ) : (
    <MultiStepSignUpFree onUpgradeToPremium={handleUpgradeToPremium} initialSpot={initialSpot} />
  );
} 