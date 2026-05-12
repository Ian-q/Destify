import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/session';
import { getProfileAction } from '@/lib/profile-actions';
import { ProfileForm } from './form';

export default async function ProfilePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  const profile = await getProfileAction();
  return <ProfileForm initial={profile} />;
}
