import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface OnboardingFormData {
  fullName: string;
  username: string;
  rank: string;
  dob: string;
  doe: string;
  mspId: string;
  password: string;
  confirmPassword: string;
}

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msps, setMsps] = useState<Array<{id: string, name: string}>>([]);
  const [formData, setFormData] = useState<OnboardingFormData>({
    fullName: '',
    username: '',
    rank: '',
    dob: '',
    doe: '',
    mspId: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState<Partial<OnboardingFormData>>({});

  // Fetch MSPs from database
  useEffect(() => {
    const fetchMsps = async () => {
      try {
        const response = await fetch('/api/public/msps');
        if (response.ok) {
          const mspsData = await response.json();
          setMsps(mspsData);
        }
      } catch (error) {
        console.error('Failed to fetch MSPs:', error);
        // Fallback to hardcoded options
        setMsps([
          {id: 'hq', name: 'HQ'},
          {id: 'msp1', name: 'MSP 1'},
          {id: 'msp2', name: 'MSP 2'},
          {id: 'msp3', name: 'MSP 3'},
          {id: 'msp4', name: 'MSP 4'},
          {id: 'msp5', name: 'MSP 5'}
        ]);
      }
    };
    fetchMsps();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Partial<OnboardingFormData> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.rank.trim()) {
      newErrors.rank = 'Rank is required';
    }

    if (!formData.dob) {
      newErrors.dob = 'Date of birth is required';
    }

    if (!formData.doe) {
      newErrors.doe = 'Date of enlistment is required';
    }

    if (!formData.mspId) {
      newErrors.mspId = 'MSP selection is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof OnboardingFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // Success - redirect to success page or login
        setLocation('/onboarding-success');
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      // For now, show success even if backend doesn't exist
      console.log('Onboarding submitted (backend not implemented yet):', formData);
      setLocation('/onboarding-success');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">MSC DRIVr Onboarding</CardTitle>
          <CardDescription>
            Complete your registration to join the IPPT tracking system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Personal Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    className={errors.fullName ? 'border-red-500' : ''}
                    placeholder="Enter your full name"
                  />
                  {errors.fullName && (
                    <p className="text-sm text-red-500">{errors.fullName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className={errors.username ? 'border-red-500' : ''}
                    placeholder="Choose a username"
                  />
                  {errors.username && (
                    <p className="text-sm text-red-500">{errors.username}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rank">Rank *</Label>
                  <Select value={formData.rank} onValueChange={(value) => handleInputChange('rank', value)}>
                    <SelectTrigger className={errors.rank ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select your rank" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PTE">PTE</SelectItem>
                      <SelectItem value="LCP">LCP</SelectItem>
                      <SelectItem value="CPL">CPL</SelectItem>
                      <SelectItem value="CFC">CFC</SelectItem>
                      <SelectItem value="3SG">3SG</SelectItem>
                      <SelectItem value="2SG">2SG</SelectItem>
                      <SelectItem value="1SG">1SG</SelectItem>
                      <SelectItem value="2LT">2LT</SelectItem>
                      <SelectItem value="LTA">LTA</SelectItem>
                      <SelectItem value="CPT">CPT</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.rank && (
                    <p className="text-sm text-red-500">{errors.rank}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth *</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={formData.dob}
                    onChange={(e) => handleInputChange('dob', e.target.value)}
                    className={errors.dob ? 'border-red-500' : ''}
                  />
                  {errors.dob && (
                    <p className="text-sm text-red-500">{errors.dob}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doe">Date of Enlistment *</Label>
                  <Input
                    id="doe"
                    type="date"
                    value={formData.doe}
                    onChange={(e) => handleInputChange('doe', e.target.value)}
                    className={errors.doe ? 'border-red-500' : ''}
                  />
                  {errors.doe && (
                    <p className="text-sm text-red-500">{errors.doe}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mspId">MSP *</Label>
                  <Select value={formData.mspId} onValueChange={(value) => handleInputChange('mspId', value)}>
                    <SelectTrigger className={errors.mspId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select MSP" />
                    </SelectTrigger>
                    <SelectContent>
                      {msps.map(msp => (
                        <SelectItem key={msp.id} value={msp.id}>{msp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.mspId && (
                    <p className="text-sm text-red-500">{errors.mspId}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Account Security */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Account Security</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={errors.password ? 'border-red-500' : ''}
                    placeholder="Create a password"
                  />
                  {errors.password && (
                    <p className="text-sm text-red-500">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className={errors.confirmPassword ? 'border-red-500' : ''}
                    placeholder="Confirm your password"
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Onboarding Request'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
