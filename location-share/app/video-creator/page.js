'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Single-channel mode — go directly to the spiritual channel
export default function VideoCreatorLanding() {
  const router = useRouter();
  useEffect(() => { router.replace('/video-creator/chants'); }, [router]);
  return null;
}
