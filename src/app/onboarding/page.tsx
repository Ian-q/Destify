import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/session';
import { getProfileAction } from '@/lib/profile-actions';
import { Wizard } from './wizard';

export default async function OnboardingPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  const profile = await getProfileAction();
  if (profile) redirect('/organizer');
  return <Wizard />;
}
