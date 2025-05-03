import { useState, useEffect } from 'react';
import MultiStepSignUpFree from './MultiStepSignUpFree';

interface MultiStepSignUpProps {
  initialEmail?: string;
}

export default function MultiStepSignUp({ initialEmail }: MultiStepSignUpProps) {
  const [initialSpot, setInitialSpot] = useState<string | null>(null);

  useEffect(() => {
    // Clear any existing signup type to ensure default behavior
    localStorage.removeItem('signupType');
  }, []);

  return (
    <MultiStepSignUpFree 
      initialSpot={initialSpot} 
      initialEmail={initialEmail} 
    />
  );
} 